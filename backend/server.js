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
  completedTopicsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  nameColor: { type: DataTypes.STRING, defaultValue: "#00f2fe" }
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
    const { username, email, password, specialty, avatar, nameColor } = req.body;
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
      avatar: avatar || "🩺",
      nameColor: nameColor || "#00f2fe"
    });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, xp: user.xp, level: user.level, rank: user.rank, avatar: user.avatar, specialty: user.specialty, nameColor: user.nameColor } });
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
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, xp: user.xp, level: user.level, rank: user.rank, avatar: user.avatar, specialty: user.specialty, nameColor: user.nameColor, studiedCardsCount: user.studiedCardsCount, solvedCasesCount: user.solvedCasesCount, completedTopicsCount: user.completedTopicsCount } });
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
    const { xp, level, rank, avatar, nameColor, studiedCardsCount, solvedCasesCount, completedTopicsCount } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (xp !== undefined) user.xp = xp;
    if (level !== undefined) user.level = level;
    if (rank !== undefined) user.rank = rank;
    if (avatar !== undefined) user.avatar = avatar;
    if (nameColor !== undefined) user.nameColor = nameColor;
    if (studiedCardsCount !== undefined) user.studiedCardsCount = studiedCardsCount;
    if (solvedCasesCount !== undefined) user.solvedCasesCount = solvedCasesCount;
    if (completedTopicsCount !== undefined) user.completedTopicsCount = completedTopicsCount;

    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users/search", async (req, res) => {
  try {
    const { query } = req.query;
    const { Op } = require("sequelize");
    let whereClause = {};
    if (query) {
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(query);
      if (isUuid) {
        whereClause = { id: query };
      } else {
        whereClause = { username: { [Op.like]: `%${query}%` } };
      }
    }
    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'username', 'avatar', 'specialty', 'level', 'rank', 'nameColor'],
      limit: 50
    });
    res.json({ users });
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

const connectedUsers = new Map(); // socket.id -> user object (id, username, nameColor)
const duelQueue = []; // array of user objects waiting for duel
const activeDuels = new Map(); // lobbyId -> duel state

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Register user connection
  socket.on("register_connection", (user) => {
    if (!user || !user.id) return;
    connectedUsers.set(socket.id, user);
    socket.join(`user_${user.id}`); // private room for direct messages
    console.log(`User ${user.username} registered on socket ${socket.id}`);
  });

  // 1. Social Real-Time Chat (Direct Messages)
  socket.on("send_message", (data) => {
    // data: { receiverId, text, senderName, senderColor }
    const sender = connectedUsers.get(socket.id);
    if (!sender) return;

    const messagePayload = {
      senderId: sender.id,
      receiverId: data.receiverId,
      text: data.text,
      senderName: sender.username,
      senderColor: sender.nameColor,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Send to the receiver's private room
    io.to(`user_${data.receiverId}`).emit("receive_message", messagePayload);
    
    // Send confirmation back to sender
    messagePayload.isSelf = true;
    socket.emit("receive_message", messagePayload);
  });

  // 2. Real-Time Card Duels Matchmaking
  socket.on("join_matchmaking", () => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    // Check if someone else is waiting
    const opponentIndex = duelQueue.findIndex(u => u.id !== user.id);
    
    if (opponentIndex !== -1) {
      // Match found!
      const opponent = duelQueue.splice(opponentIndex, 1)[0];
      const lobbyId = `duel_${Date.now()}`;
      
      // Setup duel state
      activeDuels.set(lobbyId, {
        player1: user,
        player2: opponent,
        score1: 0,
        score2: 0,
        currentQ: 0
      });

      // Join both to the lobby room
      socket.join(lobbyId);
      io.sockets.sockets.get(opponent.socketId)?.join(lobbyId);

      // Define questions (randomly picked from a pool, here we just send 5)
      const duelQuestions = [
        { term: "Ацетилхолин", cat: "Фарма", def: "Медиатор парасимпатической НС." },
        { term: "Нефрон", cat: "Анатомия", def: "Структурно-функциональная единица почки." },
        { term: "Апоптоз", cat: "Патфизиология", def: "Запрограммированная клеточная гибель." },
        { term: "Лейкопения", cat: "Гематология", def: "Снижение количества лейкоцитов." },
        { term: "Сепсис", cat: "Инфекции", def: "Генерализация локальной инфекции." }
      ];

      // Notify both players
      io.to(lobbyId).emit("duel_match_found", {
        lobbyId,
        questions: duelQuestions,
        player1: { id: user.id, username: user.username, color: user.nameColor },
        player2: { id: opponent.id, username: opponent.username, color: opponent.nameColor }
      });
      
    } else {
      // Nobody waiting, join queue
      user.socketId = socket.id;
      duelQueue.push(user);
      socket.emit("matchmaking_status", { status: "waiting", message: "Ожидание противника..." });
      
      // Timeout after 30 seconds if no match
      setTimeout(() => {
        const idx = duelQueue.findIndex(u => u.socketId === socket.id);
        if (idx !== -1) {
          duelQueue.splice(idx, 1);
          socket.emit("matchmaking_timeout", { message: "Не удалось найти противника. Попробуйте позже." });
        }
      }, 30000);
    }
  });

  // Direct Friend Multiplayer Invites
  socket.on("invite_friend", (data) => {
    // data: { receiverId, type }
    const sender = connectedUsers.get(socket.id);
    if (!sender) return;
    io.to(`user_${data.receiverId}`).emit("invite_received", {
      senderId: sender.id,
      senderName: sender.username,
      type: data.type
    });
  });

  socket.on("accept_invite", (data) => {
    // data: { senderId, type }
    const receiver = connectedUsers.get(socket.id);
    if (!receiver) return;
    
    let senderSocketId = null;
    let senderUser = null;
    for (const [sId, u] of connectedUsers.entries()) {
      if (u.id === data.senderId) {
        senderSocketId = sId;
        senderUser = u;
        break;
      }
    }
    
    if (!senderSocketId) {
      socket.emit("invite_error", { message: "Отправитель приглашения не в сети." });
      return;
    }

    const lobbyId = `lobby_${Date.now()}`;
    socket.join(lobbyId);
    
    const senderSocket = io.sockets.sockets.get(senderSocketId);
    if (senderSocket) {
      senderSocket.join(lobbyId);
    }

    const lobbyState = {
      lobbyId,
      type: data.type,
      players: {
        [data.senderId]: { id: data.senderId, name: senderUser.username, score: 0, currentIdx: 0 },
        [receiver.id]: { id: receiver.id, name: receiver.username, score: 0, currentIdx: 0 }
      }
    };
    activeDuels.set(lobbyId, lobbyState);

    io.to(lobbyId).emit("game_started", {
      lobbyId,
      type: data.type,
      player1: { id: data.senderId, name: senderUser.username },
      player2: { id: receiver.id, name: receiver.username }
    });
  });

  socket.on("decline_invite", (data) => {
    // data: { senderId }
    const receiver = connectedUsers.get(socket.id);
    if (!receiver) return;
    io.to(`user_${data.senderId}`).emit("invite_declined", {
      receiverName: receiver.username
    });
  });

  // Direct game action sync
  socket.on("game_action", (data) => {
    // data: { lobbyId, actionType: 'answer', isCorrect }
    const player = connectedUsers.get(socket.id);
    const lobby = activeDuels.get(data.lobbyId);
    if (!player || !lobby) return;

    const pState = lobby.players[player.id];
    if (!pState) return;

    if (data.isCorrect) pState.score++;
    pState.currentIdx++;

    io.to(data.lobbyId).emit("game_state_update", {
      lobbyId: data.lobbyId,
      players: lobby.players
    });
  });

  // Handle player answer in matchmaking duel
  socket.on("submit_duel_answer", (data) => {
    // data: { lobbyId, isCorrect }
    const user = connectedUsers.get(socket.id);
    const duel = activeDuels.get(data.lobbyId);
    if (!user || !duel) return;

    if (duel.player1 && user.id === duel.player1.id && data.isCorrect) duel.score1++;
    if (duel.player2 && user.id === duel.player2.id && data.isCorrect) duel.score2++;

    // Broadcast update to lobby
    io.to(data.lobbyId).emit("duel_score_update", {
      player1Score: duel.score1 || 0,
      player2Score: duel.score2 || 0,
      lastAnswerer: user.username,
      isCorrect: data.isCorrect
    });
  });

  socket.on("disconnect", () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      // Remove from queue if they were waiting
      const idx = duelQueue.findIndex(u => u.id === user.id);
      if (idx !== -1) duelQueue.splice(idx, 1);
    }
    connectedUsers.delete(socket.id);
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
