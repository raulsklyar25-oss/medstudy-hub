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
const DB_URL = process.env.DATABASE_URL;
let sequelize;
if (DB_URL) {
  const needsSsl = DB_URL.includes("ssl=true") || process.env.DB_SSL === "true";
  sequelize = new Sequelize(DB_URL, {
    logging: false,
    dialectOptions: needsSsl ? {
      ssl: {
        rejectUnauthorized: false
      }
    } : {}
  });
} else {
  sequelize = new Sequelize({
    dialect: process.env.DB_DIALECT || "sqlite",
    storage: process.env.DB_STORAGE || "./database.sqlite",
    logging: false
  });
}

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
  motto: { type: DataTypes.STRING, defaultValue: "Вся жизнь - борьба за гомеостаз!" },
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

const Friendship = sequelize.define("Friendship", {
  id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  user1Id: { type: DataTypes.UUID, allowNull: false },
  user2Id: { type: DataTypes.UUID, allowNull: false }
});

const GroupChat = sequelize.define("GroupChat", {
  id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  members: { type: DataTypes.TEXT, allowNull: false } // JSON array of user IDs
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

// Helper function to calculate Levenshtein distance for similarity checking
function levenshteinDistance(s1, s2) {
  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) {
     track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
     track[j][0] = j;
  }
  for (let j = 1; j <= s2.length; j += 1) {
     for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
           track[j][i - 1] + 1, // deletion
           track[j - 1][i] + 1, // insertion
           track[j - 1][i - 1] + indicator // substitution
        );
     }
  }
  return track[s2.length][s1.length];
}

// 1. Authentication
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, specialty, avatar, nameColor, motto } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Пожалуйста, заполните все обязательные поля" });
    }

    // Check exact email
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) return res.status(400).json({ error: "Этот email уже используется" });

    // Check exact case-insensitive username
    const existingUsername = await User.findOne({
      where: sequelize.where(
        sequelize.fn('lower', sequelize.col('username')),
        username.toLowerCase()
      )
    });
    if (existingUsername) {
      return res.status(400).json({ error: "Этот никнейм уже занят. Пожалуйста, выберите другой." });
    }

    // Check similarity: fetch all users
    const allUsers = await User.findAll({ attributes: ["username"] });
    const normalizedNew = username.toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");
    for (const u of allUsers) {
      const normalizedExisting = u.username.toLowerCase().replace(/[^a-z0-9а-яё]/gi, "");
      if (normalizedNew === normalizedExisting) {
        return res.status(400).json({ error: "Этот никнейм слишком похож на уже существующий. Пожалуйста, выберите другой." });
      }
      
      const distance = levenshteinDistance(normalizedNew, normalizedExisting);
      if (distance <= 2) {
        return res.status(400).json({ error: "Этот никнейм слишком похож на уже существующий. Пожалуйста, выберите другой." });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      passwordHash,
      specialty: specialty || "Лечебное дело",
      avatar: avatar || "🩺",
      nameColor: nameColor || "#00f2fe",
      motto: motto || "Вся жизнь - борьба за гомеостаз!"
    });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        xp: user.xp,
        level: user.level,
        rank: user.rank,
        avatar: user.avatar,
        specialty: user.specialty,
        nameColor: user.nameColor,
        motto: user.motto,
        studiedCardsCount: user.studiedCardsCount,
        solvedCasesCount: user.solvedCasesCount,
        completedTopicsCount: user.completedTopicsCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const lookup = username || email;
    if (!lookup || !password) {
      return res.status(400).json({ error: "Пожалуйста, введите логин и пароль" });
    }

    // Lookup case-insensitively by either username or email
    const user = await User.findOne({
      where: username 
        ? sequelize.where(sequelize.fn('lower', sequelize.col('username')), username.toLowerCase())
        : sequelize.where(sequelize.fn('lower', sequelize.col('email')), lookup.toLowerCase())
    });

    if (!user) return res.status(400).json({ error: "Пользователь не найден" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: "Неверный пароль" });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        xp: user.xp,
        level: user.level,
        rank: user.rank,
        avatar: user.avatar,
        specialty: user.specialty,
        nameColor: user.nameColor,
        motto: user.motto,
        studiedCardsCount: user.studiedCardsCount,
        solvedCasesCount: user.solvedCasesCount,
        completedTopicsCount: user.completedTopicsCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/update", authenticateToken, async (req, res) => {
  try {
    const { xp, level, rank, avatar, nameColor, studiedCardsCount, solvedCasesCount, completedTopicsCount, motto } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });

    if (xp !== undefined) user.xp = xp;
    if (level !== undefined) user.level = level;
    if (rank !== undefined) user.rank = rank;
    if (avatar !== undefined) user.avatar = avatar;
    if (nameColor !== undefined) user.nameColor = nameColor;
    if (studiedCardsCount !== undefined) user.studiedCardsCount = studiedCardsCount;
    if (solvedCasesCount !== undefined) user.solvedCasesCount = solvedCasesCount;
    if (completedTopicsCount !== undefined) user.completedTopicsCount = completedTopicsCount;
    if (motto !== undefined) user.motto = motto;

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
    
    const activeIds = Array.from(connectedUsers.values()).map(u => u.id);
    const usersWithOnlineStatus = users.map(u => {
      const uJson = u.toJSON();
      uJson.online = activeIds.includes(uJson.id);
      return uJson;
    });
    
    res.json({ users: usersWithOnlineStatus });
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

    // AI Bots completely disabled on backend forum creation

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


// --- ADMIN & SOCIAL FRIENDS ENDPOINTS ---

const serverLogs = [];
function logEvent(text) {
  serverLogs.unshift({ time: new Date().toLocaleTimeString(), text });
  if (serverLogs.length > 50) serverLogs.pop();
  console.log("[ADMIN LOG]", text);
}

// Friendship Sync API
app.post("/api/social/friends", authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: "Friend ID required" });

    const u1 = req.user.id < friendId ? req.user.id : friendId;
    const u2 = req.user.id < friendId ? friendId : req.user.id;

    const exists = await Friendship.findOne({ where: { user1Id: u1, user2Id: u2 } });
    if (exists) {
      return res.json({ success: true, message: "Friendship already exists" });
    }

    await Friendship.create({ user1Id: u1, user2Id: u2 });
    logEvent(`User ${req.user.username} befriended User ID ${friendId}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/social/friends", authenticateToken, async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const friendships = await Friendship.findAll({
      where: {
        [Op.or]: [
          { user1Id: req.user.id },
          { user2Id: req.user.id }
        ]
      }
    });

    const friendIds = friendships.map(f => f.user1Id === req.user.id ? f.user2Id : f.user1Id);
    const friends = await User.findAll({
      where: { id: { [Op.in]: friendIds } },
      attributes: ["id", "username", "avatar", "specialty", "level", "rank", "nameColor"]
    });

    res.json({ friends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Group Chats API
app.post("/api/social/groups", authenticateToken, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !memberIds || !Array.isArray(memberIds)) {
      return res.status(400).json({ error: "Некорректные параметры группы" });
    }

    // Add creator to members if not present
    const finalMembers = [...new Set([...memberIds, req.user.id])];

    const group = await GroupChat.create({
      name,
      members: JSON.stringify(finalMembers)
    });

    // Notify all online invited members via sockets
    finalMembers.forEach(mId => {
      io.to(`user_${mId}`).emit("group_created", {
        id: group.id,
        name: group.name,
        members: finalMembers
      });
    });

    res.json({ success: true, group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/social/groups", authenticateToken, async (req, res) => {
  try {
    const groups = await GroupChat.findAll();
    const myGroups = groups.filter(g => {
      try {
        const members = JSON.parse(g.members);
        return Array.isArray(members) && members.includes(req.user.id);
      } catch (e) {
        return false;
      }
    }).map(g => ({
      id: g.id,
      name: g.name,
      members: JSON.parse(g.members)
    }));

    res.json({ groups: myGroups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Middleware
const checkAdmin = (req, res, next) => {
  const passcode = req.headers["x-admin-passcode"] || req.query.passcode;
  if (passcode === "0981") {
    next();
  } else {
    res.status(403).json({ error: "Access Denied: Invalid Master Passcode" });
  }
};

app.get("/api/admin/stats", checkAdmin, async (req, res) => {
  try {
    const usersCount = await User.count();
    const friendshipsCount = await Friendship.count();
    const topicsCount = await ForumTopic.count();
    const repliesCount = await ForumReply.count();
    const booksCount = await CustomBook.count();
    
    res.json({
      usersCount,
      friendshipsCount,
      topicsCount,
      repliesCount,
      booksCount,
      onlineCount: connectedUsers.size
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/users", checkAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "username", "email", "xp", "level", "rank", "avatar", "specialty", "nameColor", "createdAt"]
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/friendships", checkAdmin, async (req, res) => {
  try {
    const friendships = await Friendship.findAll();
    const users = await User.findAll({ attributes: ["id", "username"] });
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.username; });

    const list = friendships.map(f => ({
      id: f.id,
      user1Name: userMap[f.user1Id] || `Unknown (${f.user1Id.substring(0, 8)})`,
      user2Name: userMap[f.user2Id] || `Unknown (${f.user2Id.substring(0, 8)})`,
      createdAt: f.createdAt
    }));

    res.json({ friendships: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/users/:id/xp", checkAdmin, async (req, res) => {
  try {
    const { xp, level } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (xp !== undefined) user.xp = parseInt(xp);
    if (level !== undefined) user.level = parseInt(level);

    await user.save();
    logEvent(`Admin updated XP/Level for user ${user.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/users/:id", checkAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const username = user.username;
    await user.destroy();
    logEvent(`Admin deleted user ${username} (${req.params.id})`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/logs", checkAdmin, (req, res) => {
  res.json({ logs: serverLogs });
});


// --- WEBSOCKET CHAT & DUEL EVENT HANDLING ---

const connectedUsers = new Map(); // socket.id -> user object (id, username, nameColor)
const duelQueue = []; // array of user objects waiting for duel
const activeDuels = new Map(); // lobbyId -> duel state

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Register user connection
  socket.on("register_connection", (user) => {
    if (!user || !user.id) {
      console.warn(`[SOCKET WARN] register_connection failed: invalid user data: ${JSON.stringify(user)}`);
      return;
    }
    connectedUsers.set(socket.id, user);
    socket.join(`user_${user.id}`); // private room for direct messages
    logEvent(`User ${user.username} (${user.id}) logged online`);

    // Automatically join group rooms
    GroupChat.findAll().then(groups => {
      groups.forEach(g => {
        try {
          const members = JSON.parse(g.members);
          if (Array.isArray(members) && members.includes(user.id)) {
            socket.join(`group_${g.id}`);
            console.log(`[SOCKET] Joined user ${user.username} to group_${g.id}`);
          }
        } catch(e) {}
      });
    });

    // Send the list of currently online users to this client
    const onlineIds = Array.from(connectedUsers.values()).map(u => u.id);
    socket.emit("online_users", onlineIds);

    // Broadcast that this user is now online
    socket.broadcast.emit("user_presence", { userId: user.id, status: "online" });
  });

  // 1. Social Real-Time Chat (Direct Messages & Group Chats)
  socket.on("send_message", (data) => {
    const sender = connectedUsers.get(socket.id);
    if (!sender) {
      console.warn(`[SOCKET WARN] send_message rejected: socket ${socket.id} is not registered!`);
      return;
    }
    logEvent(`User ${sender.username} sent DM to User ID ${data.receiverId}`);

    const messagePayload = {
      senderId: sender.id,
      receiverId: data.receiverId,
      text: data.text,
      senderName: sender.username,
      senderColor: sender.nameColor,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    console.log(`[SOCKET] Routing message from ${sender.username} (${sender.id}) to room user_${data.receiverId}`);
    // Send to the receiver's private room
    io.to(`user_${data.receiverId}`).emit("receive_message", messagePayload);
    
    // Send confirmation back to sender
    messagePayload.isSelf = true;
    socket.emit("receive_message", messagePayload);
  });

  socket.on("send_group_message", (data) => {
    // data: { groupId, text }
    const sender = connectedUsers.get(socket.id);
    if (!sender) return;

    const messagePayload = {
      groupId: data.groupId,
      senderId: sender.id,
      senderName: sender.username,
      senderColor: sender.nameColor,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    console.log(`[SOCKET] Broadcasting group message from ${sender.username} to group_${data.groupId}`);
    io.to(`group_${data.groupId}`).emit("receive_group_message", messagePayload);
  });

  // Group Activities (Duels & Coop Tests)
  socket.on("invite_group_activity", (data) => {
    // data: { groupId, type, systemId, subjectId }
    const sender = connectedUsers.get(socket.id);
    if (!sender) return;

    const lobbyId = `lobby_${Date.now()}`;
    socket.join(lobbyId);

    const lobbyState = {
      lobbyId,
      type: data.type, // 'duel' or 'coop'
      systemId: data.systemId,
      subjectId: data.subjectId,
      isGroup: true,
      groupId: data.groupId,
      players: {
        [sender.id]: { id: sender.id, name: sender.username, score: 0, currentIdx: 0 }
      }
    };
    activeDuels.set(lobbyId, lobbyState);

    // Send invitation to the entire group room
    io.to(`group_${data.groupId}`).emit("group_activity_invite", {
      lobbyId,
      type: data.type,
      systemId: data.systemId,
      subjectId: data.subjectId,
      senderId: sender.id,
      senderName: sender.username,
      groupId: data.groupId
    });
  });

  socket.on("join_group_activity", (data) => {
    // data: { lobbyId }
    const user = connectedUsers.get(socket.id);
    const lobby = activeDuels.get(data.lobbyId);
    if (!user || !lobby) {
      socket.emit("invite_error", { message: "Активность больше не активна." });
      return;
    }

    socket.join(data.lobbyId);
    
    // Add player to lobby
    lobby.players[user.id] = { id: user.id, name: user.username, score: 0, currentIdx: 0 };

    // Emit game_started directly to the joining socket
    const pIds = Object.keys(lobby.players);
    const p1Id = pIds[0];
    const p2Id = pIds[1] || user.id;

    socket.emit("game_started", {
      lobbyId: data.lobbyId,
      type: lobby.type,
      player1: { id: p1Id, name: lobby.players[p1Id].name },
      player2: { id: p2Id, name: lobby.players[p2Id].name },
      systemId: lobby.systemId,
      subjectId: lobby.subjectId,
      isGroup: true
    });

    // Notify all players in lobby of updated player state
    io.to(data.lobbyId).emit("game_state_update", {
      lobbyId: data.lobbyId,
      players: lobby.players
    });
  });

  socket.on("read_messages", (data) => {
    // data: { senderId }
    const reader = connectedUsers.get(socket.id);
    if (!reader) return;
    console.log(`[SOCKET] User ${reader.username} (${reader.id}) read messages from ${data.senderId}`);
    io.to(`user_${data.senderId}`).emit("messages_read", {
      readerId: reader.id
    });
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
    // data: { receiverId, type, systemId, subjectId }
    const sender = connectedUsers.get(socket.id);
    if (!sender) return;
    io.to(`user_${data.receiverId}`).emit("invite_received", {
      senderId: sender.id,
      senderName: sender.username,
      type: data.type,
      systemId: data.systemId,
      subjectId: data.subjectId
    });
  });

  socket.on("accept_invite", (data) => {
    // data: { senderId, type, systemId, subjectId }
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
      systemId: data.systemId,
      subjectId: data.subjectId,
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
      player2: { id: receiver.id, name: receiver.username },
      systemId: data.systemId,
      subjectId: data.subjectId
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
      
      // Broadcast that this user went offline
      io.emit("user_presence", { userId: user.id, status: "offline" });
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
