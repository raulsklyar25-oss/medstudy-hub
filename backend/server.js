const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { Sequelize, DataTypes } = require("sequelize");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_medstudy_key_981";

// --- MIDDLEWARES ---
app.use(helmet({
  contentSecurityPolicy: false // Allow dynamic scripts/styles from CDNs
}));
app.use(cors());
app.use(express.json());

// Rate limiting to prevent DDoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again later."
});
app.use("/api/", apiLimiter);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));

// --- DATABASE SETUP (SEQUELIZE) ---
const sequelize = new Sequelize({
  dialect: process.env.DB_DIALECT || "sqlite",
  storage: process.env.DB_STORAGE || "./database.sqlite",
  logging: false
});

// Models Definitions
const User = sequelize.define("User", {
  id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  xp: { type: DataTypes.INTEGER, defaultValue: 0 },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  rank: { type: DataTypes.STRING, defaultValue: "Младший интерн" },
  avatar: { type: DataTypes.STRING, defaultValue: "🩺" },
  specialty: { type: DataTypes.STRING, defaultValue: "Лечебное дело" },
  studiedCardsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  solvedCasesCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  completedTopicsCount: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const ForumTopic = sequelize.define("ForumTopic", {
  id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  authorName: { type: DataTypes.STRING, allowNull: false },
  authorAvatar: { type: DataTypes.STRING, defaultValue: "🩺" },
  category: { type: DataTypes.STRING, defaultValue: "clinical" },
  content: { type: DataTypes.TEXT, allowNull: false }
});

const ForumReply = sequelize.define("ForumReply", {
  id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  topicId: { type: DataTypes.UUID, allowNull: false },
  authorName: { type: DataTypes.STRING, allowNull: false },
  authorAvatar: { type: DataTypes.STRING, defaultValue: "🩺" },
  content: { type: DataTypes.TEXT, allowNull: false }
});

const CustomBook = sequelize.define("CustomBook", {
  id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  author: { type: DataTypes.STRING, defaultValue: "Загруженный файл" },
  filename: { type: DataTypes.STRING, allowNull: false },
  subjectId: { type: DataTypes.STRING, defaultValue: "other" }
});

// Relationships
ForumTopic.hasMany(ForumReply, { foreignKey: "topicId", onDelete: "CASCADE" });
ForumReply.belongsTo(ForumTopic, { foreignKey: "topicId" });

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token missing" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
};

// --- REST API ROUTES ---

// 1. Authentication
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, specialty, avatar } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Please fill all required fields" });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      passwordHash,
      specialty: specialty || "Лечебное дело",
      avatar: avatar || "🩺"
    });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, xp: user.xp, level: user.level, rank: user.rank, avatar: user.avatar, specialty: user.specialty } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, xp: user.xp, level: user.level, rank: user.rank, avatar: user.avatar, specialty: user.specialty, studiedCardsCount: user.studiedCardsCount, solvedCasesCount: user.solvedCasesCount, completedTopicsCount: user.completedTopicsCount } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/update", authenticateToken, async (req, res) => {
  try {
    const { xp, level, rank, avatar, studiedCardsCount, solvedCasesCount, completedTopicsCount } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (xp !== undefined) user.xp = xp;
    if (level !== undefined) user.level = level;
    if (rank !== undefined) user.rank = rank;
    if (avatar !== undefined) user.avatar = avatar;
    if (studiedCardsCount !== undefined) user.studiedCardsCount = studiedCardsCount;
    if (solvedCasesCount !== undefined) user.solvedCasesCount = solvedCasesCount;
    if (completedTopicsCount !== undefined) user.completedTopicsCount = completedTopicsCount;

    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Forum
app.get("/api/forum/topics", async (req, res) => {
  try {
    const topics = await ForumTopic.findAll({
      include: [ForumReply],
      order: [["createdAt", "DESC"]]
    });
    res.json({ topics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/forum/topics", authenticateToken, async (req, res) => {
  try {
    const { title, content, category, authorAvatar } = req.body;
    const topic = await ForumTopic.create({
      title,
      content,
      category: category || "clinical",
      authorName: req.user.username,
      authorAvatar: authorAvatar || "🩺"
    });

    // TRIGGER BOT AUTO-REPLY AFTER 5 SECONDS
    setTimeout(async () => {
      const bots = [
        { author: "Мария_Нейро", avatar: "🧠", text: "Интересный клинический вопрос. При разборе патогенеза этого состояния крайне важно помнить о вовлечении синаптических медиаторов." },
        { author: "Иван_Кардио", avatar: "🫀", text: "С точки зрения сердечно-сосудистой гемодинамики, здесь видна явная перегрузка объемом. Проверьте фракцию выброса." },
        { author: "Дмитрий_ПатФиз", avatar: "🔬", text: "Классический пример повреждения мембран! Не забывайте заглянуть в раздел интерактивной карты связей в меню." },
        { author: "Кирилл_Фарма", avatar: "💊", text: "Коллеги, в данном случае целесообразно рассмотреть назначение селективных ингибиторов или петлевых диуретиков." }
      ];
      const selectedBot = bots[Math.floor(Math.random() * bots.length)];
      await ForumReply.create({
        topicId: topic.id,
        authorName: selectedBot.author,
        authorAvatar: selectedBot.avatar,
        content: selectedBot.text + "\n\nРекомендую открыть учебники по теме в нашей электронной библиотеке!"
      });
    }, 5000);

    res.json({ topic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/forum/topics/:id/replies", async (req, res) => {
  try {
    const replies = await ForumReply.findAll({ where: { topicId: req.params.id } });
    res.json({ replies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/forum/topics/:id/replies", authenticateToken, async (req, res) => {
  try {
    const { content, authorAvatar } = req.body;
    const reply = await ForumReply.create({
      topicId: req.params.id,
      authorName: req.user.username,
      authorAvatar: authorAvatar || "🩺",
      content
    });
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Custom Textbook Uploads (Multer configuration)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pdf" || ext === ".epub" || ext === ".txt") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, EPUB, and TXT files are allowed!"));
    }
  }
});

app.post("/api/books/upload", authenticateToken, upload.single("bookFile"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { subjectId } = req.body;
    const book = await CustomBook.create({
      userId: req.user.id,
      title: req.file.originalname.replace(path.extname(req.file.originalname), ""),
      filename: req.file.filename,
      subjectId: subjectId || "other"
    });
    res.json({ success: true, book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/books/custom", authenticateToken, async (req, res) => {
  try {
    const books = await CustomBook.findAll({ where: { userId: req.user.id } });
    res.json({ books });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/books/custom/:id", authenticateToken, async (req, res) => {
  try {
    const book = await CustomBook.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!book) return res.status(404).json({ error: "Book not found" });

    const filePath = path.join(uploadsDir, book.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await book.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- WEBSOCKET CHAT & DUEL EVENT HANDLING ---

// Bot pools for real-time chat responses
const botReplies = [
  "Привет! Я как раз повторяю классификацию диуретиков. Что у тебя нового?",
  "Интересно! А ты знал, что при инфаркте правого желудочка нитраты противопоказаны из-за падения преднагрузки?",
  "Отличная гипотеза! Но давай сверимся с картой связей и учебником Грейса.",
  "Коллега, патогенез этого синдрома невероятно глубок. Нам нужно обсудить это подробнее на форуме."
];

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // 1. Social Real-Time Chat
  socket.on("send_message", (data) => {
    // data: { senderId, receiverId, text, senderName }
    // Emit player's message back to room
    socket.emit("receive_message", data);
    
    // Simulate virtual study buddy auto-typing and reply
    const typingDuration = 1000 + Math.random() * 1500;
    setTimeout(() => {
      socket.emit("buddy_typing", { typing: true, buddyId: data.receiverId });
      
      setTimeout(() => {
        socket.emit("buddy_typing", { typing: false, buddyId: data.receiverId });
        
        // Choose custom response
        const text = botReplies[Math.floor(Math.random() * botReplies.length)];
        socket.emit("receive_message", {
          senderId: data.receiverId,
          receiverId: data.senderId,
          text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }, 1500);
    }, typingDuration);
  });

  // 2. Card Duels Socket Logic
  socket.on("join_duel", (data) => {
    // data: { username, opponentId }
    // Setup a private lobby and push questions
    socket.join(`duel_${socket.id}`);
    
    // Simulate opponent joining after 1s
    setTimeout(() => {
      socket.emit("duel_ready", {
        lobbyId: `duel_${socket.id}`,
        opponentName: data.opponentId === "neuro_mary" ? "Мария_Нейро" : "Дмитрий_ПатФиз",
        questions: [
          { q: "Какой нерв иннервирует мимическую мускулатуру?", options: ["Тройничный", "Лицевой", "Блуждающий"], answer: 1 },
          { q: "Где синтезируется альбумин?", options: ["Почки", "Селезенка", "Печень"], answer: 2 },
          { q: "Основной фактор онкотического давления крови?", options: ["Глобулины", "Альбумины", "Ионы Na+"], answer: 1 }
        ]
      });
    }, 1000);
  });

  // Handle player answer in duel
  socket.on("submit_duel_answer", (data) => {
    // data: { lobbyId, score, questionIndex, correct }
    // Simulating opponent answering as well
    setTimeout(() => {
      const oppCorrect = Math.random() > 0.3;
      socket.emit("opponent_duel_answer", {
        questionIndex: data.questionIndex,
        correct: oppCorrect,
        scoreDelta: oppCorrect ? 15 : 0
      });
    }, 800 + Math.random() * 1200);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// --- INIT APP AND START SERVER ---
sequelize.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`MedStudy Hub server running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Database sync failed:", err);
});
