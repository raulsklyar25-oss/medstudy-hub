/* ==========================================
   MEDSTUDY HUB: CORE APPLICATION LOGIC
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Safe localStorage wrapper to prevent SecurityError when running under local file:// protocol
  const safeStorage = {
    memoryStore: {},
    getItem(key) {
      try {
        const val = localStorage.getItem(key);
        return val;
      } catch (e) {
        console.warn(`localStorage blocked for key '${key}', using memory fallback:`, e);
        return this.memoryStore[key] || null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn(`localStorage write blocked for key '${key}', saving in memory:`, e);
        this.memoryStore[key] = String(value);
      }
    },
    removeItem(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        delete this.memoryStore[key];
      }
    }
  };

  // Helper helper to parse JSON safely
  function safeJsonParse(jsonStr, fallback) {
    if (!jsonStr) return fallback;
    try {
      return JSON.parse(jsonStr) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  const BACKEND_URL = "https://medstudy-hub-pawd.onrender.com";
  const API_URL = `${BACKEND_URL}/api`;
  let socket = null;
  
  try {
    socket = io(BACKEND_URL, {
      reconnectionDelayMax: 10000,
    });
  } catch(e) {
    console.warn("Socket.io failed to initialize");
  }

  // --- APPLICATION STATE ---
  const state = {
    xp: parseInt(safeStorage.getItem("med_xp")) || 0,
    level: parseInt(safeStorage.getItem("med_level")) || 1,
    completedTopics: safeJsonParse(safeStorage.getItem("med_completed_topics"), []),
    studiedCardsCount: parseInt(safeStorage.getItem("med_cards_count")) || 0,
    solvedCasesCount: parseInt(safeStorage.getItem("med_cases_count")) || 0,
    userResources: safeJsonParse(safeStorage.getItem("med_resources"), []),
    
    // Active modules states
    activeView: "dashboard",
    
    // System Workspace state
    activeSystemId: "cardiovascular",
    activeSubjectId: "anatomy",

    // Flashcards state
    currentDeck: [],
    currentCardIndex: 0,
    
    // Quiz state
    activeQuizQuestions: [],
    currentQuizQuestionIndex: 0,
    quizScore: 0,
    quizTimerInterval: null,
    quizSeconds: 0,

    // Clinical Case state
    activeCase: null,
    activeCaseStepIndex: 0,
    casePointsEarned: 150,

    // 3D Anatomy state
    selectedOrganId: null,
    xrayMode: false,
    rotationEnabled: false,

    // Clinical Quest state
    currentQuestIndex: 0,
    currentQuestSymptomCount: 1,
    questCompleted: false,

    // Lab Analyzer state
    currentLabIndex: 0,

    // Achievements state (loaded from localStorage)
    achievements: (function() {
      try {
        const stored = localStorage.getItem("medstudy_achievements");
        if (stored) { const obj = JSON.parse(stored); return Object.keys(obj); }
      } catch(e) {}
      return [];
    })()
  };

  // --- RANKS CONFIGURATION ---
  const RANKS = [
    { threshold: 0, title: "Младший интерн 🧑‍⚕️" },
    { threshold: 500, title: "Старший интерн 🩺" },
    { threshold: 1200, title: "Врач-ординатор 🏥" },
    { threshold: 2500, title: "Ассистент кафедры 🔬" },
    { threshold: 4500, title: "Доцент 🧠" },
    { threshold: 7000, title: "Профессор медицины 👑" }
  ];

  // --- DOM ELEMENTS CACHE ---
  const views = document.querySelectorAll(".app-view");
  const menuItems = document.querySelectorAll(".menu-item");
  const globalSearchInput = document.getElementById("global-search");
  
  // XP Widget
  const userLevelEl = document.getElementById("user-level");
  const userRankEl = document.getElementById("user-rank");
  const xpTextEl = document.getElementById("xp-text");
  const xpFillEl = document.getElementById("xp-fill");
  const headerXpEl = document.getElementById("header-xp");
  const headerCompletedEl = document.getElementById("header-completed-topics");

  // Dashboard elements
  const dashXpEl = document.getElementById("dash-xp");
  const dashCardsEl = document.getElementById("dash-cards-studied");
  const dashCasesEl = document.getElementById("dash-cases-solved");
  const dashMnemonicEl = document.getElementById("dash-mnemonic-text");
  const dashCaseTitleEl = document.getElementById("dash-case-title");
  const dashCaseDescEl = document.getElementById("dash-case-desc");
  const dashCaseDiffEl = document.getElementById("dash-case-diff");
  const dashStartCaseBtn = document.getElementById("dash-start-case-btn");

  // System Workspace elements
  const systemsGrid = document.getElementById("systems-grid-container");
  const systemWorkspace = document.getElementById("system-workspace");
  const wsSystemIcon = document.getElementById("ws-system-icon");
  const wsSystemName = document.getElementById("ws-system-name");
  const wsSystemDesc = document.getElementById("ws-system-description");
  const wsSubjectTabs = document.getElementById("ws-subject-tabs");
  const wsTopicTitle = document.getElementById("ws-topic-title");
  const wsTopicSources = document.getElementById("ws-topic-sources");
  const wsTopicLogicalLink = document.getElementById("ws-topic-logical-link");
  const wsTopicBody = document.getElementById("ws-topic-body");
  const btnMarkTopicComplete = document.getElementById("btn-mark-topic-complete");
  const wsPracticeCardsBtn = document.getElementById("ws-practice-cards-btn");
  const wsPracticeQuizBtn = document.getElementById("ws-practice-quiz-btn");

  // Subjects Workspace elements
  const subjectsGrid = document.getElementById("subjects-grid-container");
  const subjectWorkspace = document.getElementById("subject-workspace");
  const wsSubjectIcon = document.getElementById("ws-subject-icon");
  const wsSubjectName = document.getElementById("ws-subject-name");
  const subjectTopicsBySystem = document.getElementById("subject-topics-by-system");

  // Flashcard elements
  const flashcardElement = document.getElementById("flashcard-element");
  const fcQuestionText = document.getElementById("fc-question-text");
  const fcAnswerText = document.getElementById("fc-answer-text");
  const fcFrontSystem = document.getElementById("fc-front-system");
  const fcFrontSubject = document.getElementById("fc-front-subject");
  const fcBackSystem = document.getElementById("fc-back-system");
  const fcBackSubject = document.getElementById("fc-back-subject");
  const fcBtnRepeat = document.getElementById("fc-btn-repeat");
  const fcBtnKnow = document.getElementById("fc-btn-know");
  const fcDeckStatus = document.getElementById("fc-deck-status");
  const fcFilterSystem = document.getElementById("fc-filter-system");
  const fcFilterSubject = document.getElementById("fc-filter-subject");
  const fcFilterType = document.getElementById("fc-filter-type");

  // Quiz elements
  const quizSetupPanel = document.getElementById("quiz-setup-panel");
  const quizActivePanel = document.getElementById("quiz-active-panel");
  const quizResultsPanel = document.getElementById("quiz-results-panel");
  const qzSetupSystem = document.getElementById("qz-setup-system");
  const qzSetupSubject = document.getElementById("qz-setup-subject");
  const btnStartQuiz = document.getElementById("btn-start-quiz");
  const qzProgressFill = document.getElementById("qz-progress-fill");
  const qzQuestionNumber = document.getElementById("qz-question-number");
  const qzTimer = document.getElementById("qz-timer");
  const qzQuestionTitle = document.getElementById("qz-question-title");
  const qzOptionsList = document.getElementById("qz-options-list");
  const qzExplanationBox = document.getElementById("qz-explanation-box");
  const qzExplanationTitle = document.getElementById("qz-explanation-title");
  const qzExplanationText = document.getElementById("qz-explanation-text");
  const qzBtnNext = document.getElementById("qz-btn-next");
  const qzResultCorrect = document.getElementById("qz-result-correct");
  const qzResultTotal = document.getElementById("qz-result-total");
  const qzResultXp = document.getElementById("qz-result-xp");
  const qzBtnRestart = document.getElementById("qz-btn-restart");
  const qzBtnToDashboard = document.getElementById("qz-btn-to-dashboard");

  // Clinical Cases elements
  const casesListContainer = document.getElementById("cases-list-container");
  const caseActivePanel = document.getElementById("case-active-panel");
  const caseCompletedPanel = document.getElementById("case-completed-panel");
  const caseWorkspaceTitle = document.getElementById("case-workspace-title");
  const casePatientHistory = document.getElementById("case-patient-history");
  const caseStepIndicator = document.getElementById("case-step-indicator");
  const caseStepQuestion = document.getElementById("case-step-question");
  const caseStepOptions = document.getElementById("case-step-options");
  const caseStepFeedback = document.getElementById("case-step-feedback");
  const caseStepFeedbackTitle = document.getElementById("case-step-feedback-title");
  const caseStepFeedbackText = document.getElementById("case-step-feedback-text");
  const caseBtnNextStep = document.getElementById("case-btn-next-step");
  const caseCompletionXp = document.getElementById("case-completion-xp");

  // Library elements
  const booksListContainer = document.getElementById("books-list-container");
  const addResourceForm = document.getElementById("add-resource-form");
  const userResourcesContainer = document.getElementById("user-resources-container");
  const noResourcesText = document.getElementById("no-resources-text");

  // Search Results elements
  const searchResultsView = document.getElementById("view-search-results");
  const searchResultsContainer = document.getElementById("search-results-container");
  const searchQueryText = document.getElementById("search-query-text");

  // Clinical Quest elements
  const questStageText = document.getElementById("quest-stage-text");
  const questProgressFill = document.getElementById("quest-progress-fill");
  const questSymptomsContainer = document.getElementById("quest-symptoms-container");
  const questXpValue = document.getElementById("quest-xp-value");
  const questOptionsContainer = document.getElementById("quest-options-container");
  const questStatusMessage = document.getElementById("quest-status-message");
  const questExplanationContainer = document.getElementById("quest-explanation-container");
  const questExplanationAlert = document.getElementById("quest-explanation-alert");
  const questExplanationText = document.getElementById("quest-explanation-text");
  const questNextBtn = document.getElementById("quest-next-btn");
  const questInteractionContainer = document.getElementById("quest-interaction-container");


  // --- INIT APPLICATION ---
  // Called once AFTER the lock screen is successfully bypassed
  function afterUnlock() {
    loadSavedFriends();
    loadUserProfile();
    setupSocialSystem();
    setupFriendSearch();
    renderDailyQuests();
  }

  function init() {
    setupLockScreen(); // This will call afterUnlock() upon success
    populateSystemDropdowns();
    updateProfileUI();
    loadDashboardData();
    setupNavigation();
    setupSearch();
    renderSystemsList();
    renderSubjectsList();
    setupFlashcardsListeners();
    setupQuizListeners();
    renderClinicalCasesList();
    setupCasesListeners();
    renderBooksList();
    renderUserResources();
    setupLibraryListeners();
    setup3DAnatomy();
    setupQuestListeners();
    initConceptMap();
    
    // Fetch real users from backend to replace bots
    fetch(`${API_URL}/users/search`)
      .then(r => r.json())
      .then(data => {
        if (data.users && data.users.length > 0) {
          botUsersDatabase.length = 0; // clear bots
          data.users.forEach(u => {
            botUsersDatabase.push({
              id: u.id,
              name: u.username,
              avatar: u.avatar || "🧑‍⚕️",
              specialty: u.specialty || "Врач",
              status: u.rank || "Интерн",
              color: u.nameColor || "#00f2fe",
              online: true
            });
          });
        }
      })
      .catch(e => console.warn("Could not fetch real users:", e));
  }

  // Populate dynamic select dropdowns with all systems from data.js
  function populateSystemDropdowns() {
    const selectors = [fcFilterSystem, qzSetupSystem];
    selectors.forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '<option value="all">Все системы</option>';
      Object.values(MedData.systems).forEach(sys => {
        const opt = document.createElement("option");
        opt.value = sys.id;
        opt.textContent = sys.name;
        sel.appendChild(opt);
      });
    });
  }

  // --- GAMIFICATION / XP MANAGEMENT ---
  function addXP(amount) {
    state.xp += amount;
    
    // Level Up Check: level-up threshold is level * 500
    const threshold = state.level * 500;
    if (state.xp >= threshold) {
      state.xp -= threshold;
      state.level += 1;
      showLevelUpNotification(state.level);
    }
    
    safeStorage.setItem("med_xp", state.xp);
    safeStorage.setItem("med_level", state.level);
    
    updateProfileUI();
    loadDashboardData();
  }

  function updateProfileUI() {
    userLevelEl.textContent = state.level;
    headerXpEl.textContent = state.xp + (state.level - 1) * 500;
    
    // Find rank
    const totalXp = state.xp + (state.level - 1) * 500;
    let activeRank = RANKS[0].title;
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (totalXp >= RANKS[i].threshold) {
        activeRank = RANKS[i].title;
        break;
      }
    }
    userRankEl.textContent = activeRank;
    
    // Progress bar
    const threshold = state.level * 500;
    const progressPercent = Math.min(100, (state.xp / threshold) * 100);
    xpFillEl.style.width = `${progressPercent}%`;
    xpTextEl.textContent = `${state.xp} / ${threshold} XP`;
    
    // Header completed topics
    headerCompletedEl.textContent = state.completedTopics.length;
  }

  function showLevelUpNotification(newLevel) {
    const levelUpToast = document.createElement("div");
    levelUpToast.className = "glass-panel";
    levelUpToast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 20px 30px;
      border-color: var(--accent-cyan);
      box-shadow: var(--glow-cyan);
      z-index: 9999;
      animation: slide-up 0.5s ease-out;
      text-align: center;
    `;
    levelUpToast.innerHTML = `
      <h3 style="color:var(--accent-cyan); font-family:var(--font-heading); margin-bottom:8px;">🎉 НОВЫЙ УРОВЕНЬ! 🎉</h3>
      <p style="font-size:14px;">Вы достигли <b>уровня ${newLevel}</b>! Продолжайте в том же духе.</p>
    `;
    document.body.appendChild(levelUpToast);
    
    setTimeout(() => {
      levelUpToast.style.animation = "fade-in 0.5s reverse ease-in";
      setTimeout(() => levelUpToast.remove(), 500);
    }, 4000);
  }

  // --- TOAST NOTIFICATION SYSTEM ---
  function showToast(message, type = "info", duration = 3500) {
    const existingToast = document.getElementById("global-toast");
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.id = "global-toast";
    const icons = { info: "\u2139\uFE0F", success: "\u2705", error: "\u274C", warning: "\u26A0\uFE0F" };
    const colors = {
      info: "linear-gradient(135deg, rgba(0,242,254,0.15), rgba(0,180,220,0.08))",
      success: "linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,200,100,0.08))",
      error: "linear-gradient(135deg, rgba(255,71,87,0.15), rgba(200,50,50,0.08))",
      warning: "linear-gradient(135deg, rgba(255,200,0,0.15), rgba(200,150,0,0.08))"
    };
    const borderColors = {
      info: "rgba(0,242,254,0.4)", success: "rgba(0,255,136,0.4)",
      error: "rgba(255,71,87,0.4)", warning: "rgba(255,200,0,0.4)"
    };
    if (type === "info") {
      if (message.includes("успешно") || message.includes("🎉") || message.includes("✅")) type = "success";
      else if (message.includes("ошибк") || message.includes("Ошибк") || message.includes("❌")) type = "error";
      else if (message.includes("⚠")) type = "warning";
    }
    const icon = icons[type] || icons.info;
    toast.style.cssText = `position:fixed;top:24px;right:24px;max-width:420px;min-width:280px;padding:16px 22px;background:${colors[type]||colors.info};backdrop-filter:blur(20px);border:1px solid ${borderColors[type]||borderColors.info};border-radius:14px;color:#e0e0e0;font-family:'Inter',sans-serif;font-size:14px;line-height:1.5;z-index:99998;box-shadow:0 8px 32px rgba(0,0,0,0.4);display:flex;align-items:center;gap:12px;transform:translateY(-50px) scale(0.9);opacity:0;transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1);`;
    toast.innerHTML = `<span style="font-size:22px;flex-shrink:0;">${icon}</span><span style="flex:1;">${message}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { requestAnimationFrame(() => { toast.style.transform = "translateY(0) scale(1)"; toast.style.opacity = "1"; }); });
    setTimeout(() => { toast.style.transform = "translateY(-20px) scale(0.95)"; toast.style.opacity = "0"; setTimeout(() => toast.remove(), 400); }, duration);
  }

  // --- NAVIGATION (Routing) ---
  function setupNavigation() {
    menuItems.forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const targetView = item.getAttribute("data-view");
        navigateToView(targetView);
      });
    });

    // Handle internal redirects
    const systemDashCard = document.getElementById("dash-card-systems");
    if (systemDashCard) {
      systemDashCard.addEventListener("click", () => navigateToView("systems"));
    }
    
    const mnemonicDashCard = document.getElementById("dash-card-mnemonics");
    if (mnemonicDashCard) {
      mnemonicDashCard.addEventListener("click", () => {
        fcFilterType.value = "mnemonic";
        navigateToView("flashcards");
      });
    }
    
    // System workspace back button
    document.querySelectorAll(".back-to-systems-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        navigateToView("systems");
      });
    });

    // Subject workspace back button
    document.querySelectorAll(".back-to-subjects-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        navigateToView("subjects");
      });
    });

    // Search back buttons
    document.querySelectorAll(".back-to-dashboard-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        navigateToView("dashboard");
        globalSearchInput.value = "";
      });
    });
  }

  function navigateToView(viewId) {
    state.activeView = viewId;
    
    // Update menu items active class
    menuItems.forEach(item => {
      if (item.getAttribute("data-view") === viewId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Hide all views
    views.forEach(view => {
      view.classList.add("hidden");
    });
    if (searchResultsView) {
      searchResultsView.classList.add("hidden");
    }

    // Show targets
    const targetEl = document.getElementById(`view-${viewId}`);
    if (targetEl) {
      targetEl.classList.remove("hidden");
    }

    // Trigger modules loading
    if (viewId === "dashboard") {
      loadDashboardData();
    } else if (viewId === "flashcards") {
      loadFlashcardDeck();
    } else if (viewId === "quizzes") {
      resetQuizUI();
    } else if (viewId === "cases") {
      closeCaseWorkspace();
      renderClinicalCasesList();
    } else if (viewId === "anatomy-3d") {
      if (typeof selectOrgan === "function" && !state.selectedOrganId) {
        selectOrgan("brain");
      }
    } else if (viewId === "clinical-quest") {
      startQuestSession();
    } else if (viewId === "concept-map") {
      initConceptMap();
    } else if (viewId === "lab-analyzer") {
      initLabAnalyzer();
    } else if (viewId === "calculator") {
      initClinicalCalculator();
    } else if (viewId === "profile") {
      syncSocialStats();
      renderProfileView();
    } else if (viewId === "community") {
      if (state.activeFriendId) {
        const friend = friendsList.find(f => f.id === state.activeFriendId);
        if (friend) {
          friend.chatHistory.forEach(m => {
            if (m.sender === "received") m.isRead = true;
          });
          saveFriendsToStorage();
          if (socket && socket.connected) {
            socket.emit("read_messages", { senderId: state.activeFriendId });
          }
        }
      }
      renderFriendsList();
    } else if (viewId === "forum") {
      renderForumThreads();
    }
  }

  // --- SEARCH ENGINE ---
  function setupSearch() {
    if (globalSearchInput) {
      globalSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const query = globalSearchInput.value.trim().toLowerCase();
          if (query.length > 0) {
            executeSearch(query);
          }
        }
      });
    }
  }

  function executeSearch(query) {
    if (!searchResultsView || !searchResultsContainer || !searchQueryText) return;
    
    searchQueryText.textContent = `"${query}"`;
    searchResultsContainer.innerHTML = "";
    
    // Hide all views and show search view
    views.forEach(v => v.classList.add("hidden"));
    searchResultsView.classList.remove("hidden");
    
    let resultsCount = 0;

    // Search in topics
    MedData.topics.forEach(topic => {
      if (topic.title.toLowerCase().includes(query) || topic.summary.toLowerCase().includes(query) || topic.logicalConnection.toLowerCase().includes(query)) {
        resultsCount++;
        const systemName = MedData.systems[topic.systemId].name;
        const subjectName = MedData.subjects[topic.subjectId].name;
        
        const card = document.createElement("div");
        card.className = "search-result-card glass-panel";
        card.innerHTML = `
          <div class="result-breadcrumbs">${systemName} • ${subjectName}</div>
          <h3>${topic.title}</h3>
          <p>${topic.logicalConnection}</p>
        `;
        card.addEventListener("click", () => {
          // Open system workspace with this topic
          state.activeSystemId = topic.systemId;
          state.activeSubjectId = topic.subjectId;
          navigateToView("systems");
          openSystemWorkspace(topic.systemId);
        });
        searchResultsContainer.appendChild(card);
      }
    });

    // Search in flashcards
    MedData.flashcards.forEach(cardData => {
      if (cardData.question.toLowerCase().includes(query) || cardData.answer.toLowerCase().includes(query)) {
        resultsCount++;
        const systemName = MedData.systems[cardData.systemId].name;
        const subjectName = MedData.subjects[cardData.subjectId].name;
        
        const card = document.createElement("div");
        card.className = "search-result-card glass-panel";
        card.innerHTML = `
          <div class="result-breadcrumbs">Карточка • ${systemName} • ${subjectName}</div>
          <h3>Вопрос: ${cardData.question}</h3>
          <p>Ответ: ${cardData.answer.replace(/<[^>]*>/g, "")}</p>
        `;
        card.addEventListener("click", () => {
          fcFilterSystem.value = cardData.systemId;
          fcFilterSubject.value = cardData.subjectId;
          navigateToView("flashcards");
        });
        searchResultsContainer.appendChild(card);
      }
    });

    if (resultsCount === 0) {
      searchResultsContainer.innerHTML = `
        <div style="text-align:center; padding: 40px; color: var(--text-muted);">
          <span style="font-size:40px;">🔍</span>
          <p style="margin-top:15px;">Ничего не найдено по вашему запросу. Попробуйте ввести другие ключевые слова.</p>
        </div>
      `;
    }
  }

  // --- DASHBOARD MODULE ---
  function loadDashboardData() {
    dashXpEl.textContent = state.xp + (state.level - 1) * 500;
    dashCardsEl.textContent = state.studiedCardsCount;
    dashCasesEl.textContent = state.solvedCasesCount;

    // Dynamically render and update systems progress mini cards in Dashboard
    const miniListEl = document.querySelector(".systems-mini-list");
    if (miniListEl) {
      miniListEl.innerHTML = "";
      Object.values(MedData.systems).forEach(sys => {
        const totalTopics = MedData.topics.filter(t => t.systemId === sys.id).length;
        const completedCount = MedData.topics.filter(t => t.systemId === sys.id && state.completedTopics.includes(t.id)).length;
        const percentage = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;
        
        const item = document.createElement("div");
        item.className = "mini-item";
        item.setAttribute("data-system", sys.id);
        item.innerHTML = `
          <span class="mini-icon">${sys.icon}</span>
          <div class="mini-info">
            <h4>${sys.name}</h4>
            <div class="mini-progress-bar"><div class="mini-progress-fill" style="width:${percentage}%"></div></div>
          </div>
        `;
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          navigateToView("systems");
          openSystemWorkspace(sys.id);
        });
        miniListEl.appendChild(item);
      });
    }

    // Mnemonic of the day
    const mnemonics = MedData.flashcards.filter(fc => fc.type === "mnemonic");
    if (mnemonics.length > 0) {
      // Pick a pseudo-random mnemonic based on date
      const day = new Date().getDate();
      const dailyMnemonic = mnemonics[day % mnemonics.length];
      dashMnemonicEl.innerHTML = `<b>${dailyMnemonic.question}</b><br><br>${dailyMnemonic.answer}`;
    }

    // Recommended clinical case
    if (MedData.clinicalCases.length > 0) {
      const dailyCase = MedData.clinicalCases[0];
      dashCaseTitleEl.textContent = dailyCase.title;
      dashCaseDescEl.textContent = dailyCase.description;
      dashCaseDiffEl.textContent = dailyCase.difficulty;
      
      // Wire button
      dashStartCaseBtn.onclick = () => {
        navigateToView("cases");
        openCaseWorkspace(dailyCase);
      };
    }
  }

  // --- SYSTEMS MODULE ---
  function renderSystemsList() {
    if (!systemsGrid) return;
    systemsGrid.innerHTML = "";
    Object.values(MedData.systems).forEach(system => {
      const totalTopics = MedData.topics.filter(t => t.systemId === system.id).length;
      const completedCount = MedData.topics.filter(t => t.systemId === system.id && state.completedTopics.includes(t.id)).length;
      const progressPercent = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

      const card = document.createElement("div");
      card.className = "system-card glass-panel";
      card.innerHTML = `
        <div class="card-title-row">
          <span class="sys-icon">${system.icon}</span>
          <h3>${system.name}</h3>
        </div>
        <p class="card-description">${system.description}</p>
        <div class="mini-progress-bar" style="margin-top:10px;"><div class="mini-progress-fill" style="width:${progressPercent}%"></div></div>
        <div class="card-stats-row">
          <span>Прогресс: ${progressPercent}%</span>
          <span>${completedCount} из ${totalTopics} тем</span>
        </div>
      `;
      
      card.addEventListener("click", () => {
        openSystemWorkspace(system.id);
      });
      
      systemsGrid.appendChild(card);
    });
  }

  function openSystemWorkspace(systemId) {
    state.activeSystemId = systemId;
    
    // Navigate to full workspace page
    navigateToView("system-workspace");

    // Populate header info
    const system = MedData.systems[systemId];
    wsSystemIcon.textContent = system.icon;
    wsSystemName.textContent = system.name;
    wsSystemDesc.textContent = system.description;

    // Populate Horizontal Tabs
    wsSubjectTabs.innerHTML = "";
    Object.values(MedData.subjects).forEach(subject => {
      // Check if topic exists for this system and subject
      const hasTopic = MedData.topics.some(t => t.systemId === systemId && t.subjectId === subject.id);
      
      const tab = document.createElement("div");
      tab.className = `subject-tab ${state.activeSubjectId === subject.id ? "active" : ""} ${!hasTopic ? "disabled" : ""}`;
      tab.style.opacity = hasTopic ? "1" : "0.5";
      tab.innerHTML = `<span>${subject.icon}</span> ${subject.name}`;
      
      if (hasTopic) {
        tab.addEventListener("click", () => {
          // Update active tab styling
          document.querySelectorAll(".subject-tab").forEach(t => t.classList.remove("active"));
          tab.classList.add("active");
          
          state.activeSubjectId = subject.id;
          renderSystemTheoryContent(systemId, subject.id);
        });
      }
      wsSubjectTabs.appendChild(tab);
    });

    // Load active theory
    // Fallback if the selected subject doesn't exist in this system
    const hasActiveTopic = MedData.topics.some(t => t.systemId === systemId && t.subjectId === state.activeSubjectId);
    if (!hasActiveTopic) {
      // Find first available subject that has a topic
      const firstAvail = Object.values(MedData.subjects).find(sub => MedData.topics.some(t => t.systemId === systemId && t.subjectId === sub.id));
      if (firstAvail) {
        state.activeSubjectId = firstAvail.id;
        // Remake tabs to highlight correct active one
        openSystemWorkspace(systemId);
        return;
      }
    }

    renderSystemTheoryContent(systemId, state.activeSubjectId);
  }

  function renderSystemTheoryContent(systemId, subjectId) {
    const topic = MedData.topics.find(t => t.systemId === systemId && t.subjectId === subjectId);
    if (!topic) return;
        wsTopicTitle.textContent = topic.title;
        wsTopicSources.textContent = `Источники: ${topic.sources.join(", ")}`;
        wsTopicLogicalLink.textContent = topic.logicalConnection;
        wsTopicBody.innerHTML = topic.summary;
        applyWikiLinks(wsTopicBody);

        // Re-render LaTeX math formulas if MathJax is loaded
        triggerMathJax();

        // Complete button state
        updateCompleteButtonState(topic.id);

        // Wire practice buttons
        wsPracticeCardsBtn.onclick = () => {
          fcFilterSystem.value = systemId;
          fcFilterSubject.value = subjectId;
          navigateToView("flashcards");
        };

        wsPracticeQuizBtn.onclick = () => {
          qzSetupSystem.value = systemId;
          qzSetupSubject.value = subjectId;
          navigateToView("quizzes");
          // Autostart quiz
          btnStartQuiz.click();
        };

        // Wire complete topic action
        btnMarkTopicComplete.onclick = () => {
          if (!state.completedTopics.includes(topic.id)) {
            state.completedTopics.push(topic.id);
            safeStorage.setItem("med_completed_topics", JSON.stringify(state.completedTopics));
            addXP(100); // 100 XP reward
            updateCompleteButtonState(topic.id);
            renderSystemsList(); // refresh systems progress
          }
        };
      }

      function updateCompleteButtonState(topicId) {
        if (state.completedTopics.includes(topicId)) {
          btnMarkTopicComplete.textContent = "✔ Изучено (+100 XP)";
          btnMarkTopicComplete.className = "btn btn-success btn-sm";
          btnMarkTopicComplete.disabled = true;
        } else {
          btnMarkTopicComplete.textContent = "Отметить как изучено";
          btnMarkTopicComplete.className = "btn btn-outline btn-sm";
          btnMarkTopicComplete.disabled = false;
        }
      }

      // --- SUBJECTS MODULE ---
      function renderSubjectsList() {
        if (!subjectsGrid) return;
        subjectsGrid.innerHTML = "";
        Object.values(MedData.subjects).forEach(subject => {
          const totalTopics = MedData.topics.filter(t => t.subjectId === subject.id).length;

          const card = document.createElement("div");
          card.className = "subject-card glass-panel";
          card.innerHTML = `
            <div class="card-title-row">
              <span class="sub-icon">${subject.icon}</span>
              <h3>${subject.name}</h3>
            </div>
            <p class="card-description">Изучение предмета во всех системах тела человека.</p>
            <div class="card-stats-row" style="margin-top:15px; border-top: 1px solid rgba(255,255,255,0.05); padding-top:10px;">
              <span>Доступно тем: ${totalTopics}</span>
            </div>
          `;
          
          card.addEventListener("click", () => {
            openSubjectWorkspace(subject.id);
          });

          subjectsGrid.appendChild(card);
        });
      }

      function openSubjectWorkspace(subjectId) {
        // Navigate to full subject workspace page
        navigateToView("subject-workspace");

        const subject = MedData.subjects[subjectId];
        wsSubjectIcon.textContent = subject.icon;
        wsSubjectName.textContent = subject.name;

        // Populate topics list grouped by system
        subjectTopicsBySystem.innerHTML = "";
        
        Object.values(MedData.systems).forEach(system => {
          const topics = MedData.topics.filter(t => t.systemId === system.id && t.subjectId === subjectId);
          if (topics.length === 0) return; // skip if no topics

          const sysGroup = document.createElement("div");
          sysGroup.className = "system-group-box";
          sysGroup.innerHTML = `
            <div class="system-group-title">${system.icon} ${system.name}</div>
            <div class="topics-list-mini" id="topics-list-${system.id}-${subjectId}"></div>
          `;
          subjectTopicsBySystem.appendChild(sysGroup);

          const miniList = document.getElementById(`topics-list-${system.id}-${subjectId}`);
          topics.forEach(topic => {
            const item = document.createElement("div");
            item.className = "topic-list-item";
            
            const isComplete = state.completedTopics.includes(topic.id);
            const statusBadge = isComplete ? `<span style="color:var(--accent-green)">✔ Изучено</span>` : `<span style="color:var(--text-dim)">Не начато</span>`;
            
            item.innerHTML = `
              <h4>${topic.title}</h4>
              ${statusBadge}
            `;
            item.addEventListener("click", () => {
              // Open System workspace preselected
              state.activeSystemId = system.id;
              state.activeSubjectId = subjectId;
              navigateToView("systems");
              openSystemWorkspace(system.id);
            });
            miniList.appendChild(item);
          });
        });
      }

      // --- FLASHCARDS MODULE ---
      function setupFlashcardsListeners() {
        if (flashcardElement) {
          flashcardElement.addEventListener("click", () => {
            flashcardElement.classList.toggle("flipped");
          });
        }

        fcFilterSystem.addEventListener("change", loadFlashcardDeck);
        fcFilterSubject.addEventListener("change", loadFlashcardDeck);
        fcFilterType.addEventListener("change", loadFlashcardDeck);

        const fcSocialDuelBtn = document.getElementById("btn-fc-social-duel");
        if (fcSocialDuelBtn) {
          fcSocialDuelBtn.onclick = () => {
            const friendId = state.activeFriendId || "pathphys_dmitry";
            navigateToView("community");
            openChatWithFriend(friendId);
            startCardDuel(friendId);
          };
        }

        fcBtnKnow.addEventListener("click", () => {
          addXP(15); // +15 XP per card known
          state.studiedCardsCount++;
          trackDailyAction("card_studied");
          safeStorage.setItem("med_cards_count", state.studiedCardsCount);
          nextFlashcard();
        });

        fcBtnRepeat.addEventListener("click", () => {
          // Re-add to deck tail to repeat
          const currentCard = state.currentDeck[state.currentCardIndex];
          if (currentCard) {
            state.currentDeck.push(currentCard);
          }
          nextFlashcard();
        });
      }

  function generateProceduralFlashcards(systemId, subjectId, count) {
    const sys = systemData[systemId];
    if (!sys) return [];
    
    const cards = [];
    let h = 0;
    const seedStr = "fc_" + systemId + "_" + subjectId;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
    }
    const random = () => {
      let x = Math.sin(h++) * 10000;
      return x - Math.floor(x);
    };
    const pick = (arr) => arr[Math.floor(random() * arr.length)];

    for (let fNum = 1; fNum <= count; fNum++) {
      let questionText = "";
      let answerText = "";
      let cardType = "classic";

      const organ = pick(sys.organs);
      const cell = pick(sys.cells);
      const protein = pick(sys.proteins);
      const disease = pick(sys.diseases);
      const drug = pick(sys.drugs);
      const param = pick(sys.parameters);
      const process = pick(sys.processes);

      if (subjectId === "anatomy") {
        const templates = [
          {
            q: `Какова анатомическая топография и границы органа: "${organ}"?`,
            ans: `Анатомия: структура "${organ}" располагается в соответствующих фасциально-мышечных футлярах тела. Граничит с магистральными сосудисто-нервными пучками. Окружена плотным листком собственной фасции, фиксирующим её положение.`
          },
          {
            q: `Каковы особенности кровоснабжения и венозного оттока образования: "${organ}"?`,
            ans: `Кровоснабжение: артериальная кровь притекает к структуре "${organ}" через прямые ветви регионарного артериального бассейна. Венозный отток происходит по одноименным венам непосредственно в систему полых или воротной вен.`
          }
        ];
        const template = templates[fNum % templates.length];
        questionText = template.q;
        answerText = template.ans;
      } else if (subjectId === "histology") {
        const templates = [
          {
            q: `Опишите микроскопическое строение и типы клеток в составе: "${organ}" ([${cell}]).`,
            ans: `Гистология: паренхима структуры "${organ}" представлена специализированными высокодифференцированными клетками ([${cell}]). Эпителиальная выстилка адаптирована для обеспечения процессов "${process}", имея развитые контакты и ультраструктурные органеллы.`
          }
        ];
        const template = templates[fNum % templates.length];
        questionText = template.q;
        answerText = template.ans;
      } else if (subjectId === "physiology") {
        const templates = [
          {
            q: `Какова основная физиологическая роль параметра: "${param}" в структуре "${organ}"?`,
            ans: `Физиология: показатель "${param}" отражает функциональную активность органа "${organ}". Модулируется вегетативной нервной системой (симпатикотония стимулирует его, парасимпатикотония тормозит) для поддержания гомеостаза.`
          }
        ];
        const template = templates[fNum % templates.length];
        questionText = template.q;
        answerText = template.ans;
      } else if (subjectId === "biochemistry") {
        const templates = [
          {
            q: `Какова метаболическая и сигнальная роль белка: "${protein}" в клетках "${cell}"?`,
            ans: `Биохимия: молекула "${protein}" является ключевым внутриклеточным или рецепторным белком, регулирующим процесс "${process}" в составе "${cell}". Повышение его концентрации в сыворотке крови указывает на деструкцию мембран.`
          }
        ];
        const template = templates[fNum % templates.length];
        questionText = template.q;
        answerText = template.ans;
      } else if (subjectId === "pathophysiology") {
        const templates = [
          {
            q: `Каковы ключевые звенья патогенеза патологического процесса: "${process}" при заболевании "${disease}"?`,
            ans: `Патофизиология: нарушение процесса "${process}" запускает метаболические расстройства, ведущие к клеточной гипоксии, снижению синтеза АТФ митохондриями и сдвигу показателя "${param}" от физиологической нормы.`
          }
        ];
        const template = templates[fNum % templates.length];
        questionText = template.q;
        answerText = template.ans;
      } else if (subjectId === "pathology") {
        const templates = [
          {
            q: `Каковы макро- и микроскопические проявления заболевания "${disease}" в структуре "${organ}"?`,
            ans: `Патоморфология: макроскопически при патологии "${disease}" орган "${organ}" выглядит уплотненным, с зонами изменения цвета. Микроскопически обнаруживается некроз специализированных клеток, инфильтрация лейкоцитами и фиброз.`
          }
        ];
        const template = templates[fNum % templates.length];
        questionText = template.q;
        answerText = template.ans;
      } else if (subjectId === "pharmacology") {
        const templates = [
          {
            q: `Опишите фармакодинамику, побочные эффекты и показания к применению препарата: "${drug}".`,
            ans: `Фармакология: препарат "${drug}" избирательно регулирует целевые рецепторы или ферменты. Назначается для терапии заболевания "${disease}", способствуя восстановлению показателя "${param}" до нормальных значений.`
          }
        ];
        const template = templates[fNum % templates.length];
        questionText = template.q;
        answerText = template.ans;
      }

      cards.push({
        id: `proc_fc_${systemId}_${subjectId}_${fNum}`,
        systemId: systemId,
        subjectId: subjectId,
        type: cardType,
        question: `${questionText} (Карточка #${fNum})`,
        answer: answerText
      });
    }

    return cards;
  }

  function loadFlashcardDeck() {
    const sysVal = fcFilterSystem.value;
    const subVal = fcFilterSubject.value;
    const typeVal = fcFilterType.value;

    let filtered = [];
    if (sysVal === "all" && subVal === "all") {
      const systems = ["cardiovascular", "nervous", "respiratory", "digestive", "urinary", "endocrine"];
      const subjects = ["anatomy", "histology", "physiology", "biochemistry", "pathophysiology", "pathology", "pharmacology"];
      systems.forEach(sys => {
        subjects.forEach(sub => {
          filtered = filtered.concat(generateProceduralFlashcards(sys, sub, 25));
        });
      });
    } else if (sysVal === "all") {
      const systems = ["cardiovascular", "nervous", "respiratory", "digestive", "urinary", "endocrine"];
      systems.forEach(sys => {
        filtered = filtered.concat(generateProceduralFlashcards(sys, subVal, 170));
      });
    } else if (subVal === "all") {
      const subjects = ["anatomy", "histology", "physiology", "biochemistry", "pathophysiology", "pathology", "pharmacology"];
      subjects.forEach(sub => {
        filtered = filtered.concat(generateProceduralFlashcards(sysVal, sub, 150));
      });
    } else {
      filtered = generateProceduralFlashcards(sysVal, subVal, 1000);
    }

    if (typeVal !== "all") {
      filtered = filtered.filter(fc => fc.type === typeVal);
    }

    // Shuffle active deck
    state.currentDeck = shuffleArray([...filtered]);
    state.currentCardIndex = 0;

    renderFlashcard();
  }

      function renderFlashcard() {
        // Reset flipped state
        flashcardElement.classList.remove("flipped");

        if (state.currentDeck.length === 0) {
          fcQuestionText.textContent = "Нет карточек для выбранных фильтров.";
          fcAnswerText.textContent = "Измените параметры фильтрации вверху.";
          fcFrontSystem.textContent = "—";
          fcFrontSubject.textContent = "—";
          fcBackSystem.textContent = "—";
          fcBackSubject.textContent = "—";
          fcBtnKnow.disabled = true;
          fcBtnRepeat.disabled = true;
          fcDeckStatus.textContent = "0 из 0";
          return;
        }

        fcBtnKnow.disabled = false;
        fcBtnRepeat.disabled = false;

        const card = state.currentDeck[state.currentCardIndex];
        fcQuestionText.innerHTML = card.question;
        fcAnswerText.innerHTML = card.answer;
        
        // Tag labels
        const sysName = MedData.systems[card.systemId].name;
        const subName = MedData.subjects[card.subjectId].name;

        fcFrontSystem.textContent = sysName;
        fcFrontSubject.textContent = subName;
        fcBackSystem.textContent = sysName;
        fcBackSubject.textContent = subName;

        // Status
        fcDeckStatus.textContent = `Карточка ${state.currentCardIndex + 1} из ${state.currentDeck.length}`;

        // Render LaTeX Math formulas
        triggerMathJax();
      }

      function nextFlashcard() {
        if (state.currentDeck.length === 0) return;
        
        // Wait for card flip animation reset before changing text
        flashcardElement.classList.remove("flipped");
        
        setTimeout(() => {
          state.currentCardIndex++;
          if (state.currentCardIndex >= state.currentDeck.length) {
            // Deck finished! Restart or wrap up
            showFlashcardCompletionSummary();
            state.currentCardIndex = 0;
          }
          renderFlashcard();
        }, 200);
      }

      function showFlashcardCompletionSummary() {
        const toast = document.createElement("div");
        toast.className = "glass-panel";
        toast.style.cssText = `
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          padding: 20px 30px;
          border-color: var(--accent-green);
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
          z-index: 9999;
          animation: fade-in 0.5s ease-out;
          text-align: center;
        `;
        toast.innerHTML = `
          <h3 style="color:var(--accent-green); font-family:var(--font-heading); margin-bottom:8px;">🌟 Колода пройдена! 🌟</h3>
          <p style="font-size:14px;">Отличная работа по запоминанию медицинских терминов.</p>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }

      // --- QUIZZES MODULE ---
      function setupQuizListeners() {
        btnStartQuiz.addEventListener("click", startQuiz);
        const quizSocialCoopBtn = document.getElementById("btn-quiz-social-coop");
        if (quizSocialCoopBtn) {
          quizSocialCoopBtn.onclick = () => {
            const friendId = state.activeFriendId || "sklif_anya";
            navigateToView("community");
            openChatWithFriend(friendId);
            startCoopQuiz(friendId);
          };
        }
        qzBtnNext.addEventListener("click", nextQuizQuestion);
        qzBtnRestart.addEventListener("click", () => {
          quizResultsPanel.classList.add("hidden");
          quizSetupPanel.classList.remove("hidden");
        });
        qzBtnToDashboard.addEventListener("click", () => {
          navigateToView("dashboard");
        });
      }

  const systemData = {
    cardiovascular: {
      name: "Сердечно-сосудистая система",
      organs: ["сердце", "миокард", "аорта", "левый желудочек", "правый желудочек", "коронарные артерии", "митральный клапан", "аортальный клапан", "капилляры"],
      cells: ["кардиомиоциты", "эндотелиоциты", "пейсмейкерные клетки", "волокна Пуркинье"],
      proteins: ["тропнин I", "креатинкиназа-MB", "миоглобин", "BNP (натрийуретический пептид)"],
      diseases: ["инфаркт миокарда", "стенокардия", "артериальная гипертензия", "миокардит", "атеросклероз", "сердечная недостаточность"],
      drugs: ["дигоксин", "эналаприл", "амлодипин", "метопролол", "нитроглицерин", "аспирин"],
      parameters: ["давление", "ЧСС", "ударный объем", "фракция выброса", "общее периферическое сопротивление сосудов (ОПСС)"],
      processes: ["деполяризация желудочков", "систола", "диастола", "сокращение миокарда"]
    },
    nervous: {
      name: "Нервная система",
      organs: ["головной мозг", "мозжечок", "гипоталамус", "кора полушарий", "продолговатый мозг", "спинной мозг", "симпатический ствол", "блуждающий нерв"],
      cells: ["нейроны", "астроциты", "олигодендроциты", "микроглия", "клетки Шванна"],
      proteins: ["ацетилхолинэстераза", "миелин", "нейрофиламенты", "глутаматные рецепторы"],
      diseases: ["рассеянный склероз", "болезнь Паркинсона", "болезнь Альцгеймера", "инсульт", "менингит", "эпилепсия"],
      drugs: ["леводопа", "диазепам", "амитриптилин", "прозерин", "галоперидол", "карбамазепин"],
      parameters: ["мембранный потенциал", "скорость проведения импульса", "концентрация дофамина", "внутричерепное давление"],
      processes: ["генерация потенциала действия", "синаптическая передача", "демиелинизация", "обратный захват медиаторов"]
    },
    respiratory: {
      name: "Дыхательная система",
      organs: ["легкие", "трахея", "бронхи", "бронхиолы", "альвеолярные ходы", "плевральная полость"],
      cells: ["альвеолоциты I типа", "альвеолоциты II типа", "реснитчатые эпителиоциты", "бокаловидные клетки"],
      proteins: ["сурфактант", "карбоангидраза", "муцин", "альфа-1-антитрипсин"],
      diseases: ["пневмония", "бронхиальная астма", "ХОБЛ", "эмфизема легких", "плеврит", "туберкулез"],
      drugs: ["сальбутамол", "будесонид", "амброксол", "эуфиллин", "кодеин", "ипратропия бромид"],
      parameters: ["жизненная емкость легких (ЖЕЛ)", "объем форсированного выдоха (ОФВ1)", "парциальное давление кислорода (pO2)", "альвеолярное мертвое пространство"],
      processes: ["диффузия газов", "вентиляция", "секреция сурфактанта", "бронхоспазм"]
    },
    digestive: {
      name: "Пищеварительная система",
      organs: ["желудок", "печень", "двенадцатиперстная кишка", "поджелудочная железа", "пищевод", "тонкая кишка", "толстая кишка", "желчный пузырь"],
      cells: ["париетальные клетки", "главные клетки", "гепатоциты", "энтероциты", "клетки Купфера"],
      proteins: ["пепсин", "амилаза", "трипсин", "липаза", "внутренний фактор Касла", "альбумин"],
      diseases: ["язвенная болезнь", "ГЭРБ", "цирроз печени", "панкреатит", "холецистит", "колит"],
      drugs: ["омепразол", "панкреатин", "дротаверин", "ранитидин", "метоклопрамид", "лактулоза"],
      parameters: ["кислотность желудочного сока (pH)", "уровень печеночных трансаминаз (АЛТ/АСТ)", "секреция желчи", "уровень амилазы крови"],
      processes: ["пристеночное пищеварение", "перистальтика", "желчеотделение", "всасывание липидов"]
    },
    urinary: {
      name: "Мочевыделительная система",
      organs: ["почки", "нефрон", "клубочек нефрона", "проксимальный каналец", "петля Генле", "собирательные трубочки", "мочевой пузырь"],
      cells: ["подоциты", "клетки плотного пятна (macula densa)", "мезангиальные клетки", "эпителий канальцев"],
      proteins: ["аквапорин-2", "ренин", "эритропоэтин", "мочевина", "креатинин"],
      diseases: ["гломерулонефрит", "пиелонефрит", "мочекаменная болезнь", "острая почечная недостаточность", "ХБП", "нефротический синдром"],
      drugs: ["фуросемид", "спиронолактон", "гидрохлоротиазид", "манитол", "каптоприл"],
      parameters: ["скорость клубочковой фильтрации (СКФ)", "почечный клиренс", "осмолярность мочи", "диурез"],
      processes: ["ультрафильтрация", "канальцевая реабсорбция", "канальцевая секреция", "фильтрация плазмы"]
    },
    endocrine: {
      name: "Эндокринная система",
      organs: ["гипофиз", "щитовидная железа", "надпочечники", "островки Лангерганса", "паращитовидные железы", "эпифиз"],
      cells: ["бета-клетки", "альфа-клетки", "тироциты", "хромаффинные клетки"],
      proteins: ["инсулин", "тироксин", "кортизол", "адреналин", "глюкагон", "ТТГ", "паратгормон"],
      diseases: ["сахарный диабет", "гипотиреоз", "тиреотоксикоз", "синдром Иценко-Кушинга", "феохромоцитома", "аддисонова болезнь"],
      drugs: ["метформин", "левотироксин", "преднизолон", "инсулин гларгин", "мерказолил"],
      parameters: ["уровень глюкозы плазмы", "осмолярность крови", "артериальное давление", "базальный метаболизм"],
      processes: ["секреция гормонов", "гликогенолиз", "глюконеогенез", "липолиз"]
    }
  };

  function generateProceduralQuizzes(systemId, subjectId, count) {
    const sys = systemData[systemId];
    if (!sys) return [];
    
    const quizzes = [];
    let h = 0;
    const seedStr = systemId + "_" + subjectId;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
    }
    const random = () => {
      let x = Math.sin(h++) * 10000;
      return x - Math.floor(x);
    };
    const pick = (arr) => arr[Math.floor(random() * arr.length)];
    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    for (let qNum = 1; qNum <= count; qNum++) {
      let questionText = "";
      let correctOpt = "";
      let wrongOpts = [];
      let explanationText = "";
      
      const organ = pick(sys.organs);
      const cell = pick(sys.cells);
      const protein = pick(sys.proteins);
      const disease = pick(sys.diseases);
      const drug = pick(sys.drugs);
      const param = pick(sys.parameters);
      const process = pick(sys.processes);

      if (subjectId === "anatomy") {
        const templates = [
          {
            q: `Укажите топографическую анатомию: какая структура расположена в непосредственной близости от образования: "${organ}"?`,
            ans: `Сосудисто-нервный пучок данной зоны`,
            wrongs: ["Периферический лимфатический узел", "Блуждающий нерв (ствол)", "Глубокая фасция шеи", "Сухожильный центр диафрагмы"],
            exp: `Топографическая анатомия этой области описывает прохождение крупного сосудисто-нервного пучка рядом с указанной структурой.`
          },
          {
            q: `Какая крупная артерия осуществляет непосредственное кровоснабжение структуры: "${organ}"?`,
            ans: `Соответствующая ветвь регионарного ствола`,
            wrongs: ["Внутренняя грудная артерия", "Передняя межжелудочковая артерия", "Общая сонная артерия", "Почечная артерия"],
            exp: `Кровоснабжение данного анатомического образования происходит из бассейна основного регионарного артериального ствола.`
          },
          {
            q: `Какое анатомическое образование граничит с задней поверхностью структуры: "${organ}"?`,
            ans: `Заднее средостение и прилежащие фасциальные футляры`,
            wrongs: ["Щитовидная железа", "Переднее средостение", "Венечный синус сердца", "Грудина и реберные хрящи"],
            exp: `Сзади от указанной структуры анатомически располагаются элементы заднего средостения.`
          }
        ];
        const template = templates[qNum % templates.length];
        questionText = template.q;
        correctOpt = template.ans;
        wrongOpts = template.wrongs;
        explanationText = template.exp;

      } else if (subjectId === "histology") {
        const templates = [
          {
            q: `Какие специализированные клетки ([${cell}]) гистологически характерны для структуры "${organ}"?`,
            ans: `Дифференцированные клетки этой ткани`,
            wrongs: ["Многослойный плоский ороговевающий эпителий", "Псевдомногослойный реснитчатый эпителий", "Рыхлая волокнистая соединительная ткань", "Ретикулярные клетки"],
            exp: `Гистологический срез данной области подтверждает преобладание специализированных функциональных клеток.`
          },
          {
            q: `Какая ультраструктурная особенность клеток "${cell}" обеспечивает процесс "${process}"?`,
            ans: `Наличие многочисленных мембранных контактов и органелл`,
            wrongs: ["Наличие кератиновых фибрилл", "Высокая концентрация лизосом", "Слабо развитая эндоплазматическая сеть", "Отсутствие митохондрий"],
            exp: `Специфические ультраструктурные компоненты клетки обеспечивают ее высокую метаболическую и проводящую активность.`
          }
        ];
        const template = templates[qNum % templates.length];
        questionText = template.q;
        correctOpt = template.ans;
        wrongOpts = template.wrongs;
        explanationText = template.exp;

      } else if (subjectId === "physiology") {
        const templates = [
          {
            q: `Какое влияние оказывает активация вегетативной нервной системы на показатель "${param}" в структуре "${organ}"?`,
            ans: `Регуляторное изменение в зависимости от типа рецепторов`,
            wrongs: ["Полное прекращение сократимости", "Снижение проницаемости мембран до нуля", "Немедленный спазм гладкой мускулатуры", "Отсутствие каких-либо изменений"],
            exp: `Показатель модулируется симпатическим и парасимпатическим отделами через соответствующие рецепторы.`
          },
          {
            q: `Что является основным физиологическим триггером для процесса "${process}"?`,
            ans: `Изменение потенциала действия и вход ионов-активаторов`,
            wrongs: ["Резкое падение температуры", "Выделение углекислого газа", "Снижение осмотического давления", "Свободнорадикальное окисление"],
            exp: `Физиологический запуск этого процесса обусловлен генерацией электрического импульса и изменением ионного баланса.`
          }
        ];
        const template = templates[qNum % templates.length];
        questionText = template.q;
        correctOpt = template.ans;
        wrongOpts = template.wrongs;
        explanationText = template.exp;

      } else if (subjectId === "biochemistry") {
        const templates = [
          {
            q: `Какой биохимический маркер из группы ([${protein}]) является наиболее специфичным при патологии "${disease}"?`,
            ans: `Специфический изофермент или белок мишень`,
            wrongs: ["Кислая фосфатаза сыворотки", "Щелочная фосфатаза", "Альфа-амилаза мочи", "Неспецифическая эстераза"],
            exp: `Диагностика заболевания возрастает при количественном определении специфического белкового маркера в плазме крови.`
          },
          {
            q: `Какой биохимический процесс активируется при избытке молекул "${protein}" в клетках "${cell}"?`,
            ans: `Каскад фосфорилирования и активация вторичных посредников`,
            wrongs: ["Анаэробный гликолиз в цитозоле", "Окислительное дезаминирование аминокислот", "Синтез гликогена", "Торможение цикла трикарбоновых кислот"],
            exp: `Данные сигнальные молекулы запускают ферментативный каскад внутриклеточных изменений.`
          }
        ];
        const template = templates[qNum % templates.length];
        questionText = template.q;
        correctOpt = template.ans;
        wrongOpts = template.wrongs;
        explanationText = template.exp;

      } else if (subjectId === "pathophysiology") {
        const templates = [
          {
            q: `Какое ключевое изменение показателя "${param}" лежит в основе патогенеза заболевания "${disease}"?`,
            ans: `Патологическое отклонение от гомеостатической нормы`,
            wrongs: ["Компенсаторная гипертрофия левого предсердия", "Физиологический покой органа", "Полная блокада рецепторов", "Снижение осмолярности мочи"],
            exp: `Патофизиология данного состояния характеризуется стойким нарушением функционального параметра.`
          },
          {
            q: `Какой типовой патологический процесс развивается при нарушении процесса "${process}" в структуре "${organ}"?`,
            ans: `Ишемическое повреждение и гипоксия клеток`,
            wrongs: ["Катаральное воспаление слизистой", "Физиологическая регенерация ткани", "Гиперэргическая реакция немедленного типа", "Острый некроз ткани без воспаления"],
            exp: `Нарушение этого процесса ведет к дефициту кислорода и повреждению клеточных мембран.`
          }
        ];
        const template = templates[qNum % templates.length];
        questionText = template.q;
        correctOpt = template.ans;
        wrongOpts = template.wrongs;
        explanationText = template.exp;

      } else if (subjectId === "pathology") {
        const templates = [
          {
            q: `Какие характерные микроскопические изменения выявляются при биопсии структуры "${organ}" при заболевании "${disease}"?`,
            ans: `Некроз, воспалительная инфильтрация и дистрофия клеток`,
            wrongs: ["Полная сохранность тканевой архитектоники", "Наличие атипичных многоядерных клеток Лангханса", "Жировая инфильтрация стромы без повреждения паренхимы", "Отек стромы без клеточной реакции"],
            exp: `Патоморфологический анализ выявляет деструкцию клеток, отек интерстиция и скопление лейкоцитов.`
          },
          {
            q: `Какое морфологическое проявление процесса "${process}" обнаруживается на вскрытии при патологии "${disease}"?`,
            ans: `Макроскопические признаки повреждения и склероза`,
            wrongs: ["Абсолютно неизмененный вид органа", "Наличие гнойных затеков во всех полостях", "Казеозный некроз всей ткани", "Атрофия от давления"],
            exp: `На секции обнаруживаются характерные морфологические изменения структуры ткани.`
          }
        ];
        const template = templates[qNum % templates.length];
        questionText = template.q;
        correctOpt = template.ans;
        wrongOpts = template.wrongs;
        explanationText = template.exp;

      } else if (subjectId === "pharmacology") {
        const templates = [
          {
            q: `Каков основной фармакодинамический механизм действия препарата "${drug}" при лечении патологии "${disease}"?`,
            ans: `Специфическая блокада или стимуляция целевых рецепторов/ферментов`,
            wrongs: ["Неспецифическое связывание с белками плазмы", "Увеличение выведения жидкости почками", "Прямое разрушение клеточной стенки микроорганизма", "Снижение всасывания глюкозы в ЖКТ"],
            exp: `Фармакологический эффект препарата обусловлен его избирательным сродством к рецепторам или ферментам.`
          },
          {
            q: `Какой побочный эффект наиболее характерен при применении препарата "${drug}" для коррекции показателя "${param}"?`,
            ans: `Компенсаторные вегетативные реакции и диспепсия`,
            wrongs: ["Полная анафилаксия в 100% случаев", "Немедленное развитие судорожного синдром", "Стойкое повышение уровня сахара крови", "Разрушение костной ткани"],
            exp: `Влияние препарата на системные регуляторные механизмы может вызывать нежелательные побочные реакции.`
          }
        ];
        const template = templates[qNum % templates.length];
        questionText = template.q;
        correctOpt = template.ans;
        wrongOpts = template.wrongs;
        explanationText = template.exp;
      }

      const allOptions = shuffle([correctOpt, ...wrongOpts]);
      const correctIdx = allOptions.indexOf(correctOpt);

      quizzes.push({
        id: `proc_${systemId}_${subjectId}_${qNum}`,
        systemId: systemId,
        subjectId: subjectId,
        question: `${questionText} (Вопрос #${qNum})`,
        options: allOptions,
        correctAnswer: correctIdx,
        explanation: explanationText
      });
    }

    return quizzes;
  }

  function resetQuizUI() {
    quizSetupPanel.classList.remove("hidden");
    quizActivePanel.classList.add("hidden");
    quizResultsPanel.classList.add("hidden");
    clearInterval(state.quizTimerInterval);
  }

  function startQuiz() {
    const sysVal = qzSetupSystem.value;
    const subVal = qzSetupSubject.value;

    let filtered = [];
    if (sysVal === "all" && subVal === "all") {
      const systems = ["cardiovascular", "nervous", "respiratory", "digestive", "urinary", "endocrine"];
      const subjects = ["anatomy", "histology", "physiology", "biochemistry", "pathophysiology", "pathology", "pharmacology"];
      systems.forEach(sys => {
        subjects.forEach(sub => {
          filtered = filtered.concat(generateProceduralQuizzes(sys, sub, 25));
        });
      });
    } else if (sysVal === "all") {
      const systems = ["cardiovascular", "nervous", "respiratory", "digestive", "urinary", "endocrine"];
      systems.forEach(sys => {
        filtered = filtered.concat(generateProceduralQuizzes(sys, subVal, 170));
      });
    } else if (subVal === "all") {
      const subjects = ["anatomy", "histology", "physiology", "biochemistry", "pathophysiology", "pathology", "pharmacology"];
      subjects.forEach(sub => {
        filtered = filtered.concat(generateProceduralQuizzes(sysVal, sub, 150));
      });
    } else {
      filtered = generateProceduralQuizzes(sysVal, subVal, 1000);
    }

        // Limit to max 5 questions for a quick study session
        state.activeQuizQuestions = shuffleArray([...filtered]).slice(0, 5);
        state.currentQuizQuestionIndex = 0;
        state.quizScore = 0;
        state.quizSeconds = 0;

        // UI swap
        quizSetupPanel.classList.add("hidden");
        quizActivePanel.classList.remove("hidden");

        // Start Timer
        qzTimer.textContent = "00:00";
        clearInterval(state.quizTimerInterval);
        state.quizTimerInterval = setInterval(() => {
          state.quizSeconds++;
          const mins = String(Math.floor(state.quizSeconds / 60)).padStart(2, "0");
          const secs = String(state.quizSeconds % 60).padStart(2, "0");
          qzTimer.textContent = `${mins}:${secs}`;
        }, 1000);

        renderQuizQuestion();
      }

      function renderQuizQuestion() {
        // Hide explanation box
        qzExplanationBox.classList.add("hidden");

        const question = state.activeQuizQuestions[state.currentQuizQuestionIndex];
        qzQuestionTitle.innerHTML = question.question;

        // Progress
        const total = state.activeQuizQuestions.length;
        qzQuestionNumber.textContent = `Вопрос ${state.currentQuizQuestionIndex + 1} из ${total}`;
        qzProgressFill.style.width = `${((state.currentQuizQuestionIndex) / total) * 100}%`;

        // Render options
        qzOptionsList.innerHTML = "";
        question.options.forEach((opt, idx) => {
          const btn = document.createElement("button");
          btn.className = "quiz-option-btn";
          btn.textContent = opt;
          btn.addEventListener("click", () => handleQuizAnswerSelection(idx));
          qzOptionsList.appendChild(btn);
        });

        triggerMathJax();
      }

      function handleQuizAnswerSelection(selectedIdx) {
        const question = state.activeQuizQuestions[state.currentQuizQuestionIndex];
        const correctIdx = question.correctAnswer;

        // Lock options
        const optionButtons = qzOptionsList.querySelectorAll(".quiz-option-btn");
        optionButtons.forEach(btn => btn.disabled = true);

        // Apply color highlights
        optionButtons[correctIdx].classList.add("correct");

        const isCorrect = selectedIdx === correctIdx;
        if (isCorrect) {
          state.quizScore++;
          qzExplanationTitle.textContent = "✅ Верно!";
          qzExplanationTitle.className = "explanation-title correct";
        } else {
          optionButtons[selectedIdx].classList.add("incorrect");
          qzExplanationTitle.textContent = "❌ Неверно";
          qzExplanationTitle.className = "explanation-title incorrect";
        }

        // Show explanation
        qzExplanationText.innerHTML = question.explanation;
        qzExplanationBox.classList.remove("hidden");
      }

      function nextQuizQuestion() {
        state.currentQuizQuestionIndex++;
        if (state.currentQuizQuestionIndex >= state.activeQuizQuestions.length) {
          finishQuiz();
        } else {
          renderQuizQuestion();
        }
      }

      function finishQuiz() {
        trackDailyAction("quiz_passed");
        clearInterval(state.quizTimerInterval);
        quizActivePanel.classList.add("hidden");
        quizResultsPanel.classList.remove("hidden");

        // Calculate score & XP
        const total = state.activeQuizQuestions.length;
        const correct = state.quizScore;
        
        // Reward: 50 XP per correct answer. 100 XP bonus for perfect score.
        let xpGain = correct * 50;
        if (correct === total) {
          xpGain += 100;
        }

        addXP(xpGain);

        qzResultCorrect.textContent = correct;
        qzResultTotal.textContent = total;
        qzResultXp.textContent = `+${xpGain} XP`;
      }

      // --- CLINICAL CASES MODULE ---
  function generateProceduralClinicalCases(systemId, subjectId, count) {
    const sys = systemData[systemId];
    if (!sys) return [];

    const cases = [];
    let h = 0;
    const seedStr = "case_" + systemId + "_" + subjectId;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
    }
    const random = () => {
      let x = Math.sin(h++) * 10000;
      return x - Math.floor(x);
    };
    const pick = (arr) => arr[Math.floor(random() * arr.length)];
    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    for (let cNum = 1; cNum <= count; cNum++) {
      const organ = pick(sys.organs);
      const cell = pick(sys.cells);
      const protein = pick(sys.proteins);
      const disease = pick(sys.diseases);
      const drug = pick(sys.drugs);
      const param = pick(sys.parameters);
      const process = pick(sys.processes);

      const title = `Интерактивный кейс: Патология органа ${organ} (#${cNum})`;
      const desc = `Пациент поступил с выраженной клинической картиной нарушения в области: "${organ}". Наблюдается прогрессирующее расстройство клеток типа "${cell}" и изменение функционального параметра "${param}". Зафиксированы признаки процесса "${process}". Требуется провести верификацию диагноза и терапию.`;

      const s1Correct = `Провести забор крови на уровень специфического белка "${protein}"`;
      const s1Wrongs = ["Назначить физиотерапевтическое лечение", "Ограничиться динамическим наблюдением", "Провести пробу с дозированной физической нагрузкой"];
      const s1Opts = shuffle([s1Correct, ...s1Wrongs]);
      const s1Ans = s1Opts.indexOf(s1Correct);

      const s2Correct = `Повреждение клеток "${cell}" и критическое изменение параметра "${param}"`;
      const s2Wrongs = ["Физиологическая адаптация тканей без повреждения мембран", "Острый психосоматический синдром", "Воспалительная реакция с повышением секреции желчи"];
      const s2Opts = shuffle([s2Correct, ...s2Wrongs]);
      const s2Ans = s2Opts.indexOf(s2Correct);

      const s3Correct = `Назначить лекарственную терапию с использованием препарата "${drug}"`;
      const s3Wrongs = ["Направить на санаторно-курортное лечение", "Рекомендовать дыхательную гимнастику", "Назначить неспецифические поливитамины"];
      const s3Opts = shuffle([s3Correct, ...s3Wrongs]);
      const s3Ans = s3Opts.indexOf(s3Correct);

      cases.push({
        id: `proc_case_${systemId}_${subjectId}_${cNum}`,
        systemId: systemId,
        subjectId: subjectId,
        title: title,
        description: desc,
        difficulty: cNum % 3 === 0 ? "Высокая" : (cNum % 2 === 0 ? "Средняя" : "Легкая"),
        steps: [
          {
            question: `Шаг 1: Какое первичное диагностическое действие наиболее обоснованно для подтверждения диагноза?`,
            options: s1Opts,
            correctAnswer: s1Ans,
            explanation: `Для верификации патологии структуры "${organ}" ключевым тестом является определение биохимического уровня "${protein}", что отражает повреждение клеточных мембран.`
          },
          {
            question: `Шаг 2: Какой патогенетический механизм лежит в основе наблюдаемых симптомов у пациента?`,
            options: s2Opts,
            correctAnswer: s2Ans,
            explanation: `Патофизиология данного синдрома вызвана непосредственным дефектом структуры клеток "${cell}" и стойким сдвигом показателя "${param}".`
          },
          {
            question: `Шаг 3: Выберите оптимальный план фармакотерапии для стабилизации состояния больного.`,
            options: s3Opts,
            correctAnswer: s3Ans,
            explanation: `Терапией выбора является применение селективного препарата "${drug}", который блокирует/стимулирует мишени и купирует симптомы заболевания "${disease}".`
          }
        ]
      });
    }

    return cases;
  }

  function renderClinicalCasesList() {
    if (!casesListContainer) return;
    casesListContainer.innerHTML = "";

    const sysSetup = document.getElementById("cases-setup-system");
    const subSetup = document.getElementById("cases-setup-subject");
    const sysVal = sysSetup ? sysSetup.value : "all";
    const subVal = subSetup ? subSetup.value : "all";

    let pool = [];
    if (sysVal === "all" && subVal === "all") {
      const systems = ["cardiovascular", "nervous", "respiratory", "digestive", "urinary", "endocrine"];
      const subjects = ["anatomy", "histology", "physiology", "biochemistry", "pathophysiology", "pathology", "pharmacology"];
      systems.forEach(sys => {
        subjects.forEach(sub => {
          pool = pool.concat(generateProceduralClinicalCases(sys, sub, 1));
        });
      });
    } else if (sysVal === "all") {
      const systems = ["cardiovascular", "nervous", "respiratory", "digestive", "urinary", "endocrine"];
      systems.forEach(sys => {
        pool = pool.concat(generateProceduralClinicalCases(sys, subVal, 5));
      });
    } else if (subVal === "all") {
      const subjects = ["anatomy", "histology", "physiology", "biochemistry", "pathophysiology", "pathology", "pharmacology"];
      subjects.forEach(sub => {
        pool = pool.concat(generateProceduralClinicalCases(sysVal, sub, 5));
      });
    } else {
      pool = generateProceduralClinicalCases(sysVal, subVal, 12);
    }

    const displayPool = pool.slice(0, 20);
    displayPool.forEach(c => {
      const card = document.createElement("div");
      card.className = "case-card glass-panel";
      card.innerHTML = `
        <div style="font-size:24px; margin-bottom:10px;">📋</div>
        <h3>${c.title}</h3>
        <p>${c.description.substring(0, 160)}...</p>
        <div class="case-card-footer">
          <span style="font-size:11px; color:var(--accent-rose); font-weight:600;">СЛОЖНОСТЬ: ${c.difficulty}</span>
          <button class="btn btn-primary btn-sm">Открыть кейс</button>
        </div>
      `;
      
      card.addEventListener("click", () => openCaseWorkspace(c));
      casesListContainer.appendChild(card);
    });
  }

  function openCaseWorkspace(medicalCase) {
    state.activeCase = medicalCase;
    state.activeCaseStepIndex = 0;
    state.casePointsEarned = 150;

    const setup = document.getElementById("cases-setup-panel");
    if (setup) setup.classList.add("hidden");
    casesListContainer.classList.add("hidden");
    caseCompletedPanel.classList.add("hidden");
    caseActivePanel.classList.remove("hidden");

    caseWorkspaceTitle.textContent = medicalCase.title;
    casePatientHistory.innerHTML = `<strong>Клиническая картина:</strong><br><br>${medicalCase.description}`;
    
    renderCaseStep();
  }

      function renderCaseStep() {
        caseStepFeedback.classList.add("hidden");

        const step = state.activeCase.steps[state.activeCaseStepIndex];
        caseStepIndicator.textContent = `Шаг ${state.activeCaseStepIndex + 1} из ${state.activeCase.steps.length}`;
        caseStepQuestion.textContent = step.question;

        caseStepOptions.innerHTML = "";
        step.options.forEach((opt, idx) => {
          const btn = document.createElement("button");
          btn.className = "quiz-option-btn";
          btn.textContent = opt;
          btn.addEventListener("click", () => handleCaseOptionSelection(idx));
          caseStepOptions.appendChild(btn);
        });
      }

      function handleCaseOptionSelection(selectedIdx) {
        const step = state.activeCase.steps[state.activeCaseStepIndex];
        const correctIdx = step.correctAnswer;

        // Lock options
        const optionButtons = caseStepOptions.querySelectorAll(".quiz-option-btn");
        optionButtons.forEach(btn => btn.disabled = true);

        optionButtons[correctIdx].classList.add("correct");

        const isCorrect = selectedIdx === correctIdx;
        if (isCorrect) {
          caseStepFeedbackTitle.textContent = "✅ Верно! Отличное клиническое решение.";
          caseStepFeedbackTitle.className = "feedback-title correct";
        } else {
          optionButtons[selectedIdx].classList.add("incorrect");
          caseStepFeedbackTitle.textContent = "❌ Неверно. Пересмотрите логику диагноза.";
          caseStepFeedbackTitle.className = "feedback-title incorrect";
          state.casePointsEarned = Math.max(50, state.casePointsEarned - 30); // subtract points but floor at 50 XP
        }

        caseStepFeedbackText.innerHTML = step.explanation;
        caseStepFeedback.classList.remove("hidden");
      }

      function setupCasesListeners() {
        const startSearchBtn = document.getElementById("btn-start-cases-search");
        if (startSearchBtn) {
          startSearchBtn.onclick = () => {
            renderClinicalCasesList();
          };
        }

        caseBtnNextStep.addEventListener("click", () => {
          state.activeCaseStepIndex++;
          if (state.activeCaseStepIndex >= state.activeCase.steps.length) {
            completeClinicalCase();
          } else {
            renderCaseStep();
          }
        });

        const btnSocialCouncil = document.getElementById("btn-case-social-council");
        if (btnSocialCouncil) {
          btnSocialCouncil.onclick = () => {
            if (!state.activeCase) return;
            const step = state.activeCase.steps[state.activeCaseStepIndex];
            
            const buddies = {
              "neuro_mary": "🧠 Мария_Нейро (Невролог):",
              "cardio_ivan": "🫀 Иван_Кардио (Кардиолог):",
              "sklif_anya": "🩺 Аня_Склиф (Реаниматолог):",
              "pharma_kirill": "💊 Кирилл_Фарма (Фармаколог):"
            };
            
            let botId = "sklif_anya";
            const title = state.activeCase.title.toLowerCase();
            if (title.includes("инфаркт") || title.includes("стенокард") || title.includes("аритми")) {
              botId = "cardio_ivan";
            } else if (title.includes("инсульт") || title.includes("мозг") || title.includes("невралг")) {
              botId = "neuro_mary";
            } else if (title.includes("отравл") || title.includes("терапи") || title.includes("дозир")) {
              botId = "pharma_kirill";
            }
            
            const buddyLabel = buddies[botId];
            const correctOptText = step.options[step.correctAnswer] || step.options[step.correctOptionIndex] || "данный вариант";
            
            const hints = [
              `Хм, обрати внимание на "${correctOptText.toLowerCase()}". В клинической практике это наиболее обоснованно!`,
              `Я считаю, здесь правильное решение - "${correctOptText}", так как патогенетически это сразу устранит ключевой синдром.`,
              `Коллега, не забывай про противопоказания! Я бы выбрала "${correctOptText}".`
            ];
            
            const selectedHint = hints[state.activeCaseStepIndex % hints.length];
            state.casePointsEarned = Math.max(50, state.casePointsEarned - 25);
            
            alert(`📞 Срочный консилиум с коллегами:\n\n${buddyLabel} "${selectedHint}"\n\n(Штраф за подсказку: -25 баллов за кейс. Текущая награда: ${state.casePointsEarned} XP)`);
          };
        }

        document.querySelectorAll(".back-to-cases-btn").forEach(btn => {
          btn.addEventListener("click", closeCaseWorkspace);
        });
      }

      function completeClinicalCase() {
        caseActivePanel.classList.add("hidden");
        caseCompletedPanel.classList.remove("hidden");

        addXP(state.casePointsEarned);
        trackDailyAction("case_solved");
        state.solvedCasesCount++;
        safeStorage.setItem("med_cases_count", state.solvedCasesCount);

        caseCompletionXp.textContent = `+${state.casePointsEarned} XP`;
      }

      function closeCaseWorkspace() {
        caseActivePanel.classList.add("hidden");
        caseCompletedPanel.classList.add("hidden");
        const setup = document.getElementById("cases-setup-panel");
        if (setup) setup.classList.remove("hidden");
        casesListContainer.classList.remove("hidden");
      }

      // --- LIBRARY MODULE ---
      function renderBooksList() {
        if (!booksListContainer) return;
        booksListContainer.innerHTML = "";
        
        const buddyReaders = {
          anatomy: "Кирилл_Фарма читает эту книгу 📖",
          histology: "Мария_Нейро читает эту книгу 📖",
          physiology: "Дмитрий_ПатФиз читает эту книгу 📖",
          biochemistry: "Кирилл_Фарма читает эту книгу 📖",
          pathophysiology: "Дмитрий_ПатФиз читает эту книгу 📖",
          pathology: "Аня_Склиф читает эту книгу 📖",
          pharmacology: "Кирилл_Фарма читает эту книгу 📖"
        };

        MedData.books.forEach(book => {
          const subName = MedData.subjects[book.subjectId].name;
          const readerText = buddyReaders[book.subjectId] || "Никто из друзей не читает эту книгу";
          
          const card = document.createElement("div");
          card.className = "book-card";
          card.style.cursor = "pointer";
          card.innerHTML = `
            <div class="book-title-row">
              <h4>${book.title}</h4>
              <span style="font-size:10px; color:var(--accent-cyan); text-transform:uppercase;">${subName}</span>
            </div>
            <p class="book-author">Автор: ${book.author}</p>
            <p class="book-desc">${book.description}</p>
            <div style="font-size:11px; color:var(--text-muted); font-style:italic; margin-top: 10px; display: flex; align-items: center; gap: 4px;">
              <span>👥</span> <span>${readerText}</span>
            </div>
            <div style="margin-top: 10px; text-align: right;"><span class="btn btn-outline btn-xs" style="font-size: 11px; padding: 3px 8px;">📖 Читать книгу</span></div>
          `;
          card.addEventListener("click", () => {
            openBookReader(book.id || book.subjectId);
          });
          booksListContainer.appendChild(card);
        });
      }

      function renderUserResources() {
        if (!userResourcesContainer) return;
        userResourcesContainer.innerHTML = "";
        if (state.userResources.length === 0) {
          noResourcesText.style.display = "block";
          return;
        }
        noResourcesText.style.display = "none";

        state.userResources.forEach((res, index) => {
          const subName = MedData.subjects[res.subjectId].name;
          const item = document.createElement("div");
          item.className = "user-res-item";
          item.innerHTML = `
            <div>
              <strong>${res.title}</strong> (${subName})<br>
              <span style="font-size:11px; color:var(--text-muted);">${res.link}</span>
            </div>
            <button class="btn btn-link btn-sm" style="color:var(--accent-rose)" data-idx="${index}">Удалить</button>
          `;
          userResourcesContainer.appendChild(item);
        });

        // Wire deletes
        userResourcesContainer.querySelectorAll("button").forEach(btn => {
          btn.addEventListener("click", (e) => {
            const index = parseInt(btn.getAttribute("data-idx"));
            state.userResources.splice(index, 1);
            safeStorage.setItem("med_resources", JSON.stringify(state.userResources));
            renderUserResources();
          });
        });
      }

      function setupLibraryListeners() {
        if (!addResourceForm) return;
        addResourceForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          
          const title = document.getElementById("res-title").value.trim();
          const subjectId = document.getElementById("res-subject").value;
          const fileInput = document.getElementById("res-file");

          if (title && fileInput && fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append("bookFile", fileInput.files[0]);
            formData.append("title", title);
            formData.append("subjectId", subjectId);

            const token = safeStorage.getItem("medstudy_jwt_token");
            try {
              showToast("Загрузка книги на сервер...");
              const res = await fetch(`${API_URL}/books/upload`, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${token}`
                },
                body: formData
              });
              const data = await res.json();
              if (data.success) {
                state.userResources.push({
                  title: data.book.title,
                  subjectId: data.book.subjectId,
                  link: `${BACKEND_URL}/uploads/${data.book.filename}`
                });
                safeStorage.setItem("med_resources", JSON.stringify(state.userResources));
                addResourceForm.reset();
                renderUserResources();
                addXP(50);
                showToast("🎉 Книга успешно загружена на бэкенд!");
              } else {
                showToast(`Ошибка загрузки: ${data.error}`);
              }
            } catch (err) {
              console.error(err);
              showToast("Сервер недоступен, книга добавлена локально.");
              state.userResources.push({ title, subjectId, link: "Локальный файл" });
              safeStorage.setItem("med_resources", JSON.stringify(state.userResources));
              addResourceForm.reset();
              renderUserResources();
            }
          }
        });
      }

      // --- INTERACTIVE 3D ANATOMY (Three.js WebGL) ---
      let scene, camera, renderer, controls, bodyMesh, skeletonGroup, lungsGroup, kidneysGroup, mainAnatomyGroup;
      const organMeshes = {};

      const organNames = {
        brain: "Головной мозг",
        heart: "Сердце",
        lungs: "Легкие",
        stomach: "Желудок",
        liver: "Печень",
        kidneys: "Почки",
        skeleton: "Скелет и кости"
      };

      window.selectOrgan = function(organId) {
        state.selectedOrganId = organId;
        
        // Highlight active selector button styling
        document.querySelectorAll(".organ-sel-btn").forEach(btn => {
          btn.classList.toggle("active", btn.getAttribute("data-organ") === organId);
        });

        // Show active study buddy
        const studyBuddyMap = {
          brain: "Мария_Нейро 🧠 сейчас тоже изучает эту тему!",
          heart: "Иван_Кардио 🫀 сейчас тоже изучает эту тему!",
          lungs: "Дмитрий_ПатФиз 🔬 сейчас тоже изучает эту тему!",
          stomach: "Аня_Склиф 🩺 сейчас тоже изучает эту тему!",
          liver: "Кирилл_Фарма 💊 сейчас тоже изучает эту тему!",
          kidneys: "Аня_Склиф 🩺 сейчас тоже изучает эту тему!",
          skeleton: "Кирилл_Фарма 💊 сейчас тоже изучает эту тему!"
        };
        const activeStudyText = document.getElementById("organ-active-study-text");
        if (activeStudyText) {
          activeStudyText.textContent = studyBuddyMap[organId] || "Никто из друзей не изучает эту тему сейчас.";
        }

    // Toggle details panels
    const detailsEmpty = document.getElementById("anatomy-details-empty");
    const detailsContent = document.getElementById("anatomy-details-content");
    if (detailsEmpty && detailsContent) {
      detailsEmpty.classList.add("hidden");
      detailsContent.classList.remove("hidden");
    }

    const data = MedData.anatomy3d ? MedData.anatomy3d[organId] : null;
    if (!data) return;

    // Achievements trigger
    unlockAchievement("anatomy_explorer");

    // Fill title details
    const detOrganIcon = document.getElementById("det-organ-icon");
    const detOrganTitle = document.getElementById("det-organ-title");
    const detOrganLatin = document.getElementById("det-organ-latin");

    if (detOrganIcon) detOrganIcon.textContent = data.icon;
    if (detOrganTitle) detOrganTitle.textContent = data.name;
    if (detOrganLatin) detOrganLatin.textContent = data.latin;

    // Retrieve active tab
    let activeTab = "anatomy";
    const activeTabBtn = document.querySelector(".organ-tab.active");
    if (activeTabBtn) {
      activeTab = activeTabBtn.getAttribute("data-tab");
    }

    renderOrganTabContent(organId, activeTab);
  };

  function renderOrganTabContent(organId, tabName) {
    const contentSheet = document.getElementById("det-textbook-content");
    if (!contentSheet) return;

    const organData = MedData.anatomy3d ? MedData.anatomy3d[organId] : null;
    if (!organData) {
      contentSheet.innerHTML = "<p>База данных анатомии временно недоступна.</p>";
      return;
    }

    const content = organData[tabName] || "<p>Раздел в процессе наполнения...</p>";
    contentSheet.innerHTML = content;
    applyWikiLinks(contentSheet);

    // Re-render LaTeX math formulas if MathJax is loaded
    triggerMathJax();
  }

  function setup3DAnatomy() {
    // Select organ buttons in directory
    document.querySelectorAll(".organ-sel-btn").forEach(btn => {
      btn.onclick = () => {
        const organId = btn.getAttribute("data-organ");
        selectOrgan(organId);
      };
    });

    // Discuss organ button
    const discussBtn = document.getElementById("btn-organ-discuss");
    if (discussBtn) {
      discussBtn.onclick = () => {
        const organId = state.selectedOrganId || "brain";
        const buddyIdMap = {
          brain: "neuro_mary",
          heart: "cardio_ivan",
          lungs: "pathphys_dmitry",
          stomach: "sklif_anya",
          liver: "pharma_kirill",
          kidneys: "sklif_anya",
          skeleton: "pharma_kirill"
        };
        const buddyId = buddyIdMap[organId] || "sklif_anya";
        navigateToView("community");
        openChatWithFriend(buddyId);
      };
    }

    // Audio guide handler
    const audioBtn = document.getElementById("btn-audio-guide");
    if (audioBtn) {
      let speechUtterance = null;
      audioBtn.onclick = () => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          audioBtn.style.boxShadow = "0 0 10px rgba(0, 242, 254, 0.1)";
          audioBtn.style.background = "rgba(0, 242, 254, 0.05)";
          return;
        }
        
        const contentSheet = document.getElementById("det-textbook-content");
        if (contentSheet) {
          const rawText = contentSheet.innerText || "";
          if (rawText.trim().length > 0) {
            const cleanText = rawText
              .replace(/\\\(.*?\\\)/g, "")
              .replace(/\$\$.*?\$\$/g, "")
              .replace(/<\/?[^>]+(>|$)/g, "");
            
            speechUtterance = new SpeechSynthesisUtterance(cleanText);
            speechUtterance.lang = "ru-RU";
            
            speechUtterance.onend = () => {
              audioBtn.style.boxShadow = "0 0 10px rgba(0, 242, 254, 0.1)";
              audioBtn.style.background = "rgba(0, 242, 254, 0.05)";
            };
            
            audioBtn.style.background = "var(--accent-pink)";
            audioBtn.style.boxShadow = "0 0 15px var(--accent-pink)";
            window.speechSynthesis.speak(speechUtterance);
          }
        }
      };
    }

    // Tab buttons handler
    document.querySelectorAll(".organ-tab").forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll(".organ-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        
        const organId = state.selectedOrganId || "brain";
        const tabName = tab.getAttribute("data-tab");
        renderOrganTabContent(organId, tabName);
      };
    });

    // Default load
    selectOrgan("brain");
  }

  // --- ACCESS LOCK SCREEN LOGIC ---
  function setupLockScreen() {
    const lockScreen = document.getElementById("app-lock-screen");
    const passwordInput = document.getElementById("lock-password-input");
    const submitBtn = document.getElementById("lock-submit-btn");
    const errorMsg = document.getElementById("lock-error-msg");
    const lockCard = document.querySelector(".lock-card");
    const statusIndicator = document.getElementById("lock-status-indicator");

    if (statusIndicator) {
      statusIndicator.textContent = "✅ Система готова. Введите код.";
      statusIndicator.style.color = "#00f2fe";
    }

    const CORRECT_PASSWORD = "0981"; // Default passcode

    // Check if already authorized in current browser session
    if (safeStorage.getItem("medstudy_authorized") === "true") {
      if (lockScreen) lockScreen.classList.add("hidden");
      afterUnlock(); // Load profile & social AFTER confirming access
      return;
    }

    function checkPassword() {
      if (!passwordInput) return;
      if (passwordInput.value.trim() === CORRECT_PASSWORD) {
        safeStorage.setItem("medstudy_authorized", "true");
        if (lockScreen) {
          lockScreen.style.transition = "opacity 0.4s";
          lockScreen.style.opacity = "0";
          setTimeout(() => {
            lockScreen.classList.add("hidden");
            lockScreen.style.opacity = "";
          }, 400);
        }
        afterUnlock(); // Load profile & social after successful unlock
      } else {
        // Shake animation for incorrect password
        if (lockCard) {
          lockCard.classList.add("shake");
          setTimeout(() => lockCard.classList.remove("shake"), 400);
        }
        if (errorMsg) {
          errorMsg.classList.remove("hidden");
        }
        passwordInput.value = "";
        passwordInput.focus();
      }
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", checkPassword);
    }

    if (passwordInput) {
      passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          checkPassword();
        }
      });
    }
  }

  // --- CLINICAL QUEST LOGIC ---
  state.questGuessedOptions = [];
  state.questActiveOptions = [];

  function generateProceduralClinicalQuests(systemId, subjectId, count) {
    const sys = systemData[systemId];
    if (!sys) return [];

    const quests = [];
    let h = 0;
    const seedStr = "quest_" + systemId + "_" + subjectId;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
    }
    const random = () => {
      let x = Math.sin(h++) * 10000;
      return x - Math.floor(x);
    };
    const pick = (arr) => arr[Math.floor(random() * arr.length)];

    for (let qNum = 1; qNum <= count; qNum++) {
      const organ = pick(sys.organs);
      const cell = pick(sys.cells);
      const protein = pick(sys.proteins);
      const disease = pick(sys.diseases);
      const drug = pick(sys.drugs);
      const param = pick(sys.parameters);
      const process = pick(sys.processes);

      const diagnosisName = `${disease.charAt(0).toUpperCase() + disease.slice(1)} (Форма #${qNum})`;

      const symptoms = [
        `Пациент поступил с жалобами на выраженные функциональные нарушения структуры: "${organ}". Наблюдаются сильные боли.`,
        `Объективный осмотр выявляет патологические изменения клеток "${cell}" и стойкое отклонение параметра "${param}" от нормы.`,
        `В биохимическом анализе крови отмечается резкое повышение специфического биохимического маркера "${protein}".`,
        `При проведении инструментальных методов исследования подтвержден диагноз "${disease}" и нарушение процесса "${process}".`
      ];

      const explanation = `Клинический случай "${diagnosisName}" характеризуется развитием патологического процесса в области "${organ}" с вовлечением клеток "${cell}". Для купирования рекомендуется применение препаратов группы "${drug}", снижающих выраженность симптомов и нормализующих показатель "${param}".`;

      quests.push({
        id: `proc_q_${systemId}_${subjectId}_${qNum}`,
        systemId: systemId,
        subjectId: subjectId,
        name: diagnosisName,
        symptoms: symptoms,
        explanation: explanation
      });
    }

    return quests;
  }

  function resetQuestUI() {
    const setup = document.getElementById("quest-setup-panel");
    const layout = document.getElementById("quest-layout-panel");
    if (setup) setup.classList.remove("hidden");
    if (layout) layout.classList.add("hidden");
    if (state.questOpponentTimer) clearTimeout(state.questOpponentTimer);
  }

  function startQuestSession() {
    const sysSetup = document.getElementById("quest-setup-system");
    const subSetup = document.getElementById("quest-setup-subject");
    const sysVal = sysSetup ? sysSetup.value : "all";
    const subVal = subSetup ? subSetup.value : "all";

    let pool = [];
    if (sysVal === "all" && subVal === "all") {
      const systems = ["cardiovascular", "nervous", "respiratory", "digestive", "urinary", "endocrine"];
      const subjects = ["anatomy", "histology", "physiology", "biochemistry", "pathophysiology", "pathology", "pharmacology"];
      systems.forEach(sys => {
        subjects.forEach(sub => {
          pool = pool.concat(generateProceduralClinicalQuests(sys, sub, 25));
        });
      });
    } else if (sysVal === "all") {
      const systems = ["cardiovascular", "nervous", "respiratory", "digestive", "urinary", "endocrine"];
      systems.forEach(sys => {
        pool = pool.concat(generateProceduralClinicalQuests(sys, subVal, 170));
      });
    } else if (subVal === "all") {
      const subjects = ["anatomy", "histology", "physiology", "biochemistry", "pathophysiology", "pathology", "pharmacology"];
      subjects.forEach(sub => {
        pool = pool.concat(generateProceduralClinicalQuests(sysVal, sub, 150));
      });
    } else {
      pool = generateProceduralClinicalQuests(sysVal, subVal, 1000);
    }

    state.activeQuestPool = pool;
    state.currentQuestIndex = Math.floor(Math.random() * pool.length);
    state.currentQuestSymptomCount = 1;
    state.questGuessedOptions = [];
    state.questCompleted = false;

    const setup = document.getElementById("quest-setup-panel");
    const layout = document.getElementById("quest-layout-panel");
    if (setup) setup.classList.add("hidden");
    if (layout) layout.classList.remove("hidden");

    const opponents = ["Мария_Нейро", "Иван_Кардио", "Дмитрий_ПатФиз", "Аня_Склиф"];
    state.questOpponent = opponents[Math.floor(Math.random() * opponents.length)];
    state.questOpponentState = "thinking";
    
    const opponentText = document.getElementById("quest-opponent-text");
    if (opponentText) {
      opponentText.textContent = `Соперник: ${state.questOpponent} (думает...)`;
      opponentText.style.color = "var(--accent-pink)";
    }

    generateQuestOptions();
    renderQuestCard();
    triggerOpponentSimulation();
  }

  function generateQuestOptions() {
    const pool = state.activeQuestPool || [];
    const quest = pool[state.currentQuestIndex];
    if (!quest) return;

    const distractors = pool
      .filter(q => q.id !== quest.id)
      .map(q => q.name);
    
    const selectedDistractors = shuffleArray([...distractors]).slice(0, 4);
    
    const options = [quest.name, ...selectedDistractors];
    state.questActiveOptions = shuffleArray(options);
  }

  function triggerOpponentSimulation() {
    if (state.questOpponentTimer) clearTimeout(state.questOpponentTimer);
    if (state.questCompleted) return;

    const guessDelay = 12000 + Math.random() * 8000;
    
    state.questOpponentTimer = setTimeout(() => {
      if (state.questCompleted) return;
      
      const successChance = 0.4 + (state.currentQuestSymptomCount - 1) * 0.25;
      const botGuessedRight = Math.random() < successChance;
      
      const opponentText = document.getElementById("quest-opponent-text");
      if (botGuessedRight) {
        state.questOpponentState = "guessed";
        if (opponentText) {
          opponentText.textContent = `Соперник: ${state.questOpponent} РАЗГАДАЛ диагноз! ⚡`;
          opponentText.style.color = "var(--accent-pink)";
        }
        showToast(`⚠️ ${state.questOpponent} разгадал правильный диагноз! Дайте верный ответ быстрее!`);
      } else {
        state.questOpponentState = "incorrect";
        if (opponentText) {
          opponentText.textContent = `Соперник: ${state.questOpponent} дал неверную гипотезу! ❌`;
          opponentText.style.color = "#ef4444";
        }
        showToast(`😅 ${state.questOpponent} выдвинул ложный диагноз. У вас есть шанс!`);
        setTimeout(triggerOpponentSimulation, 5000);
      }
    }, guessDelay);
  }

  function renderQuestCard() {
    const quest = MedData.quests[state.currentQuestIndex];
    if (!quest) return;

    // Stage updates
    if (questStageText) {
      questStageText.textContent = `Кейс №${state.solvedCasesCount + 1}`;
    }
    if (questProgressFill) {
      // Progress fill goes 0% to 100% every 10 cases
      const progressPercent = ((state.solvedCasesCount % 10) / 10) * 100;
      questProgressFill.style.width = `${progressPercent}%`;
    }

    // Render current revealed symptoms
    if (questSymptomsContainer) {
      questSymptomsContainer.innerHTML = "";
      for (let i = 0; i < state.currentQuestSymptomCount; i++) {
        const card = document.createElement("div");
        card.className = "symptom-card";
        card.innerHTML = `
          <div class="symptom-number">${i + 1}</div>
          <div class="symptom-text">${quest.symptoms[i]}</div>
        `;
        questSymptomsContainer.appendChild(card);
      }
    }

    // Update potential XP reward
    const currentXpValue = 100 - (state.currentQuestSymptomCount - 1) * 25;
    if (questXpValue) {
      questXpValue.textContent = currentXpValue;
    }

    // Render option buttons (shuffled)
    if (questOptionsContainer) {
      questOptionsContainer.innerHTML = "";
      state.questActiveOptions.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "quest-option-btn";
        btn.textContent = opt;
        
        // If this option was already guessed incorrectly
        if (state.questGuessedOptions.includes(opt)) {
          btn.classList.add("wrong");
          btn.disabled = true;
        }

        btn.addEventListener("click", () => handleQuestAnswer(opt, btn));
        questOptionsContainer.appendChild(btn);
      });
    }

    // Reset visibility states
    if (questStatusMessage) questStatusMessage.classList.add("hidden");
    if (questExplanationContainer) questExplanationContainer.classList.add("hidden");
    if (questInteractionContainer) questInteractionContainer.classList.remove("hidden");
  }

  function handleQuestAnswer(selectedOption, btnElement) {
    if (state.questCompleted) return;
    const quest = MedData.quests[state.currentQuestIndex];
    if (!quest) return;

    if (selectedOption === quest.name) {
      // Success!
      state.questCompleted = true;
      if (state.questOpponentTimer) clearTimeout(state.questOpponentTimer);

      const opponentText = document.getElementById("quest-opponent-text");
      if (opponentText) {
        if (state.questOpponentState === "thinking" || state.questOpponentState === "incorrect") {
          opponentText.textContent = `Победа! Вы опередили ${state.questOpponent}! 🎉`;
          opponentText.style.color = "#10b981";
        } else {
          opponentText.textContent = `Победа, но ${state.questOpponent} разгадал раньше! ⌛`;
          opponentText.style.color = "#f59e0b";
        }
      }

      const xpEarned = 100 - (state.currentQuestSymptomCount - 1) * 25;
      addXP(xpEarned);

      // Increment stats
      state.solvedCasesCount++;
      trackDailyAction("quest_solved");
      safeStorage.setItem("med_cases_count", state.solvedCasesCount);
      loadDashboardData();

      // Achievements triggers
      unlockAchievement("first_diagnosis");
      if (state.currentQuestSymptomCount === 1) {
        unlockAchievement("perfect_diagnosis");
      }

      if (questStatusMessage) {
        questStatusMessage.className = "quest-status-message success";
        questStatusMessage.textContent = `🎉 Правильно! Получено +${xpEarned} XP!`;
        questStatusMessage.classList.remove("hidden");
      }

      // Disable options
      document.querySelectorAll(".quest-option-btn").forEach(btn => btn.disabled = true);

      // Show explanation
      setTimeout(() => {
        if (questInteractionContainer) questInteractionContainer.classList.add("hidden");
        if (questExplanationContainer) {
          questExplanationContainer.classList.remove("hidden");
          if (questExplanationAlert) {
            questExplanationAlert.className = "explanation-alert success";
            questExplanationAlert.innerHTML = `<span>✅ Верно! Диагноз подтвержден: <strong>${quest.name}</strong></span>`;
          }
          if (questExplanationText) {
            questExplanationText.innerHTML = `
              <h4>Клинический разбор патогенеза:</h4>
              <p>${quest.explanation}</p>
            `;
          }
        }
        if (questProgressFill) {
          const progressPercent = ((state.solvedCasesCount % 10) / 10) * 100;
          questProgressFill.style.width = `${progressPercent}%`;
        }
      }, 1000);

    } else {
      // Wrong guess!
      state.questGuessedOptions.push(selectedOption);
      if (btnElement) {
        btnElement.classList.add("wrong");
        btnElement.disabled = true;
      }

      // Check if there are more symptoms to reveal
      if (state.currentQuestSymptomCount < quest.symptoms.length) {
        state.currentQuestSymptomCount++;
        
        if (questStatusMessage) {
          questStatusMessage.className = "quest-status-message error";
          questStatusMessage.textContent = "❌ Неверно. Получена дополнительная жалоба!";
          questStatusMessage.classList.remove("hidden");
        }

        // Shake symptoms area
        if (questSymptomsContainer) {
          questSymptomsContainer.classList.add("shake");
          setTimeout(() => questSymptomsContainer.classList.remove("shake"), 400);
        }

        // Re-render
        setTimeout(() => {
          renderQuestCard();
        }, 1200);

      } else {
        // Fail!
        state.questCompleted = true;

        if (questStatusMessage) {
          questStatusMessage.className = "quest-status-message error";
          questStatusMessage.textContent = "❌ Все подсказки исчерпаны. Вы ошиблись.";
          questStatusMessage.classList.remove("hidden");
        }

        document.querySelectorAll(".quest-option-btn").forEach(btn => btn.disabled = true);

        setTimeout(() => {
          if (questInteractionContainer) questInteractionContainer.classList.add("hidden");
          if (questExplanationContainer) {
            questExplanationContainer.classList.remove("hidden");
            if (questExplanationAlert) {
              questExplanationAlert.className = "explanation-alert fail";
              questExplanationAlert.innerHTML = `<span>❌ Ошибка. Правильный диагноз: <strong>${quest.name}</strong></span>`;
            }
            if (questExplanationText) {
              questExplanationText.innerHTML = `
                <h4>Клинический разбор патогенеза:</h4>
                <p>${quest.explanation}</p>
              `;
            }
          }
          if (questProgressFill) {
            const progressPercent = ((state.solvedCasesCount % 10) / 10) * 100;
            questProgressFill.style.width = `${progressPercent}%`;
          }
        }, 1200);
      }
    }
  }

  function setupQuestListeners() {
    const startBtn = document.getElementById("btn-start-quest-game");
    if (startBtn) {
      startBtn.onclick = () => {
        startQuestSession();
      };
    }

    if (questNextBtn) {
      questNextBtn.onclick = () => {
        if (state.activeQuestPool && state.activeQuestPool.length > 0) {
          state.currentQuestIndex = Math.floor(Math.random() * state.activeQuestPool.length);
          state.currentQuestSymptomCount = 1;
          state.questGuessedOptions = [];
          state.questCompleted = false;

          const opponents = ["Мария_Нейро", "Иван_Кардио", "Дмитрий_ПатФиз", "Аня_Склиф"];
          state.questOpponent = opponents[Math.floor(Math.random() * opponents.length)];
          state.questOpponentState = "thinking";
          
          const opponentText = document.getElementById("quest-opponent-text");
          if (opponentText) {
            opponentText.textContent = `Соперник: ${state.questOpponent} (думает...)`;
            opponentText.style.color = "var(--accent-pink)";
          }

          generateQuestOptions();
          renderQuestCard();
          triggerOpponentSimulation();
        } else {
          resetQuestUI();
        }
      };
    }
  }

  // --- MEDICAL WIKI AUTO-LINKER ---
  const WikiMap = [
    {
      term: 'сердце',
      words: [/(?<![а-яА-ЯёЁ])(?:сердц[еауоыи]|сердечн(?:ый|ого|ому|ым|ом|ые|ых|ым|ыми))(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'heart', tab: 'anatomy' }
    },
    {
      term: 'миокард',
      words: [/(?<![а-яА-ЯёЁ])миокард(?:а|у|ом|е|ы|ов|ам|ами|ах)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'heart', tab: 'physiology' }
    },
    {
      term: 'клапан',
      words: [/(?<![а-яА-ЯёЁ])клапан(?:а|у|ом|е|ы|ов|ам|ами|ах)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'heart', tab: 'anatomy' }
    },
    {
      term: 'аорта',
      words: [/(?<![а-яА-ЯёЁ])аорт(?:а|ы|е|у|кой)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'heart', tab: 'anatomy' }
    },
    {
      term: 'мозг',
      words: [/(?<![а-яА-ЯёЁ])(?:мозг(?:а|у|ом|е|ы|ов|ам|ами|ах)?|головно(?:го|му|й|м) мозг(?:а|у|ом|е))(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'brain', tab: 'anatomy' }
    },
    {
      term: 'нейрон',
      words: [/(?<![а-яА-ЯёЁ])нейрон(?:а|у|ом|е|ы|ов|ам|ами|ах)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'brain', tab: 'histology' }
    },
    {
      term: 'синапс',
      words: [/(?<![а-яА-ЯёЁ])синапс(?:а|у|ом|е|ы|ов|ам|ами|ах)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'brain', tab: 'physiology' }
    },
    {
      term: 'кора',
      words: [/(?<![а-яА-ЯёЁ])кор(?:а|ы|е|у|ой) головного мозга(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'brain', tab: 'anatomy' }
    },
    {
      term: 'легкие',
      words: [/(?<![а-яА-ЯёЁ])легк(?:ие|их|им|ими|их|ах)(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'lungs', tab: 'anatomy' }
    },
    {
      term: 'альвеола',
      words: [/(?<![а-яА-ЯёЁ])альвеол(?:а|ы|е|у|ой|ам|ами|ах)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'lungs', tab: 'histology' }
    },
    {
      term: 'сурфактант',
      words: [/(?<![а-яА-ЯёЁ])сурфактант(?:а|у|ом|е|ы)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'lungs', tab: 'biochemistry' }
    },
    {
      term: 'бронх',
      words: [/(?<![а-яА-ЯёЁ])бронх(?:а|у|ом|е|ы|ов|ам|ами|ах)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'lungs', tab: 'anatomy' }
    },
    {
      term: 'желудок',
      words: [/(?<![а-яА-ЯёЁ])желуд(?:ок|ка|ку|ком|ке|ки|ков|кам|ках)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'stomach', tab: 'anatomy' }
    },
    {
      term: 'пепсин',
      words: [/(?<![а-яА-ЯёЁ])пепсин(?:а|у|ом|е|ы|оген)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'stomach', tab: 'biochemistry' }
    },
    {
      term: 'гастрин',
      words: [/(?<![а-яА-ЯёЁ])гастрин(?:а|у|ом|е|ы)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'stomach', tab: 'physiology' }
    },
    {
      term: 'печень',
      words: [/(?<![а-яА-ЯёЁ])печен(?:ь|и|ью|еночный|еночная|еночное|еночные)(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'liver', tab: 'anatomy' }
    },
    {
      term: 'гепатоцит',
      words: [/(?<![а-яА-ЯёЁ])гепатоцит(?:а|у|ом|е|ы|ов|ам|ами|ах)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'liver', tab: 'histology' }
    },
    {
      term: 'желчь',
      words: [/(?<![а-яА-ЯёЁ])желч(?:ь|и|ью)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'liver', tab: 'physiology' }
    },
    {
      term: 'почки',
      words: [/(?<![а-яА-ЯёЁ])поч(?:ка|ки|ку|кой|кам|ками|ках|ечный|ечные|ечной)(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'kidneys', tab: 'anatomy' }
    },
    {
      term: 'нефрон',
      words: [/(?<![а-яА-ЯёЁ])нефрон(?:а|у|ом|е|ы|ов|ам|ами|ах)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'kidneys', tab: 'histology' }
    },
    {
      term: 'мочевина',
      words: [/(?<![а-яА-ЯёЁ])мочевин(?:а|ы|е|у|ой)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'kidneys', tab: 'biochemistry' }
    },
    {
      term: 'петля генле',
      words: [/(?<![а-яА-ЯёЁ])петл(?:я|и|е|ю|ей) генле(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'kidneys', tab: 'physiology' }
    },
    {
      term: 'скелет',
      words: [/(?<![а-яА-ЯёЁ])скелет(?:а|у|ом|е|ы|ов)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'skeleton', tab: 'anatomy' }
    },
    {
      term: 'кость',
      words: [/(?<![а-яА-ЯёЁ])кост(?:ь|и|ью|ями|ях|ный|ная|ное|ные|ных)(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'skeleton', tab: 'anatomy' }
    },
    {
      term: 'остеобласт',
      words: [/(?<![а-яА-ЯёЁ])(?:остеобласт(?:а|у|ом|е|ы|ов)?|остеокласт(?:а|у|ом|е|ы|ов)?)(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'skeleton', tab: 'histology' }
    },
    {
      term: 'гидроксиапатит',
      words: [/(?<![а-яА-ЯёЁ])гидроксиапатит(?:а|у|ом|е|ы)?(?![а-яА-ЯёЁ])/iu],
      target: { type: 'organ', id: 'skeleton', tab: 'biochemistry' }
    }
  ];

  function applyWikiLinks(rootElement) {
    if (!rootElement) return;
    
    const textNodes = [];
    const walk = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walk.nextNode()) {
      if (node.parentElement && (node.parentElement.tagName === 'A' || node.parentElement.tagName === 'BUTTON' || node.parentElement.closest('a') || node.parentElement.closest('.wiki-link'))) {
        continue;
      }
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      let text = textNode.nodeValue;
      let matches = [];

      WikiMap.forEach(entry => {
        entry.words.forEach(regex => {
          let match;
          const globalRegex = new RegExp(regex.source, 'gi');
          while ((match = globalRegex.exec(text)) !== null) {
            matches.push({
              index: match.index,
              length: match[0].length,
              word: match[0],
              entry: entry
            });
          }
        });
      });

      matches.sort((a, b) => b.index - a.index);

      let lastIndex = text.length;
      const filteredMatches = [];
      matches.forEach(m => {
        if (m.index + m.length <= lastIndex) {
          filteredMatches.push(m);
          lastIndex = m.index;
        }
      });

      if (filteredMatches.length === 0) return;

      const fragment = document.createDocumentFragment();
      let currentPos = 0;
      
      filteredMatches.sort((a, b) => a.index - b.index);

      filteredMatches.forEach(m => {
        if (m.index > currentPos) {
          fragment.appendChild(document.createTextNode(text.substring(currentPos, m.index)));
        }
        
        const link = document.createElement("a");
        link.className = "wiki-link";
        link.href = "#";
        link.textContent = m.word;
        link.setAttribute("data-term", m.entry.term);
        link.title = `Вики-термин: ${m.word}`;
        link.onclick = (e) => {
          e.preventDefault();
          showWikiPopup(e.target);
        };
        fragment.appendChild(link);

        currentPos = m.index + m.length;
      });

      if (currentPos < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(currentPos)));
      }

      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    });
  }

  function showWikiPopup(targetEl) {
    const term = targetEl.getAttribute("data-term");
    const popup = document.getElementById("wiki-popup");
    const titleEl = document.getElementById("wiki-popup-title");
    const descEl = document.getElementById("wiki-popup-desc");
    const goBtn = document.getElementById("wiki-popup-go-btn");

    if (!popup) return;

    // Look up dictionary definition
    const def = MedData.wikiDictionary[term] || {
      title: term.toUpperCase(),
      definition: "Справочное описание термина находится в процессе дополнения.",
      target: { type: 'organ', id: 'brain', tab: 'anatomy' }
    };

    if (titleEl) titleEl.textContent = def.title;
    if (descEl) descEl.textContent = def.definition;

    if (goBtn) {
      goBtn.onclick = () => {
        popup.classList.add("hidden");
        navigateWiki(def.target.type, def.target.id, def.target.tab);
      };
    }

    // Position popup
    const rect = targetEl.getBoundingClientRect();
    const leftPos = rect.left + rect.width / 2 + window.scrollX;
    const topPos = rect.top + window.scrollY;

    popup.style.left = `${leftPos}px`;
    popup.style.top = `${topPos}px`;
    popup.classList.remove("hidden");

    // Achievements trigger
    unlockAchievement("wiki_reader");
  }

  // Close wiki popup on close button or clicking outside
  document.addEventListener("click", (e) => {
    const popup = document.getElementById("wiki-popup");
    if (popup && !popup.classList.contains("hidden")) {
      if (!popup.contains(e.target) && !e.target.classList.contains("wiki-link")) {
        popup.classList.add("hidden");
      }
    }
  });

  // Wire close button
  setTimeout(() => {
    const closeBtn = document.getElementById("wiki-popup-close");
    if (closeBtn) {
      closeBtn.onclick = () => {
        document.getElementById("wiki-popup").classList.add("hidden");
      };
    }
  }, 500);

  function navigateWiki(type, targetId, tabName) {
    if (type === 'organ') {
      navigateToView("anatomy-3d");
      if (typeof window.selectOrgan === "function") {
        window.selectOrgan(targetId);
      }
      
      const tabBtn = document.querySelector(`.organ-tab[data-tab="${tabName}"]`);
      if (tabBtn) {
        document.querySelectorAll(".organ-tab").forEach(b => b.classList.remove("active"));
        tabBtn.classList.add("active");
        renderOrganTabContent(targetId, tabName);
      }
    }
  }

  // --- ACHIEVEMENT SYSTEM ---
  function unlockAchievement(id) {
    let achs = {};
    try {
      achs = JSON.parse(safeStorage.getItem("medstudy_achievements") || "{}");
    } catch (e) {
      achs = {};
    }
    if (achs[id]) return;

    achs[id] = true;
    safeStorage.setItem("medstudy_achievements", JSON.stringify(achs));

    // Award bonus XP!
    addXP(100);

    // Achievements metadata
    const metadata = {
      first_diagnosis: {
        title: "Первый пациент 🩺",
        desc: "Вы успешно диагностировали вашего первого сложного пациента!"
      },
      perfect_diagnosis: {
        title: "Клинический снайпер 🎯",
        desc: "Вы угадали болезнь с первой подсказки, проявив блестящую интуицию!"
      },
      wiki_reader: {
        title: "Медицинский книжник 📚",
        desc: "Вы впервые открыли справочное Вики-определение термина на месте."
      },
      anatomy_explorer: {
        title: "3D Исследователь 🧍",
        desc: "Вы детально изучили органы в WebGL-атласе трехмерного тела."
      },
      chief_laboratory_technician: {
        title: "Главный лаборант 🧪",
        desc: "Вы впервые успешно интерпретировали результаты клинического анализа!"
      },
      clinical_mathematician: {
        title: "Клинический математик 🧮",
        desc: "Вы произвели первый расчет клинических формул дозировки или СКФ!"
      }
    };

    const ach = metadata[id];
    if (!ach) return;

    // Show achievement toast
    const toast = document.getElementById("achievement-toast");
    const titleEl = document.getElementById("achievement-title");
    const descEl = document.getElementById("achievement-desc");

    if (toast && titleEl && descEl) {
      titleEl.textContent = ach.title;
      descEl.textContent = ach.desc;
      toast.classList.remove("hidden");

      // Auto hide after 4 seconds
      setTimeout(() => {
        toast.style.animation = "slideInToast 0.4s reverse ease-in";
        setTimeout(() => {
          toast.classList.add("hidden");
          toast.style.animation = ""; // reset animation
        }, 400);
      }, 4000);
    }
  }

  function triggerMathJax() {
    if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
      window.MathJax.typesetPromise().catch(err => console.warn("MathJax formatting error:", err));
    }
  }

  // --- CONCEPT MAP FUNCTIONS ---
  function openConceptArticleModal(node) {
    const modal = document.getElementById("map-article-modal");
    const body = document.getElementById("map-article-body");
    if (!modal || !body) return;

    body.innerHTML = `
      <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 15px;">
        <span style="font-size: 32px;">📖</span>
        <div>
          <h2 style="margin: 0; color: var(--accent-cyan); font-family: var(--font-heading); font-size: 26px;">${node.name}</h2>
          <span style="font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px;">Научная статья • MedStudy Hub</span>
        </div>
      </div>
      
      <div class="article-content" style="color: rgba(255,255,255,0.9); line-height: 1.6; font-size: 15px;">
        <section style="margin-bottom: 20px;">
          <h4 style="color: var(--accent-pink); margin-bottom: 8px; font-size: 16px;">Введение и определение</h4>
          <p>${node.desc}</p>
        </section>
        
        <section style="margin-bottom: 20px;">
          <h4 style="color: var(--accent-pink); margin-bottom: 8px; font-size: 16px;">Анатомо-гистологическая характеристика</h4>
          <p>В структуре человеческого организма данный элемент занимает важное анатомическое положение. Микроструктурно он состоит из дифференцированных клеточных популяций, адаптированных под выполнение специфических функций. Тесное взаимодействие с окружающими сосудистыми и нервными путями обеспечивает интеграцию элемента в общую схему жизнедеятельности.</p>
        </section>
        
        <section style="margin-bottom: 20px;">
          <h4 style="color: var(--accent-pink); margin-bottom: 8px; font-size: 16px;">Физиология и метаболические процессы</h4>
          <p>Функциональная роль заключается в непрерывном поддержании локального гомеостаза. На молекулярном уровне протекают ферментативные реакции, регулирующие биохимический баланс. Элемент участвует в мембранном транспорте веществ, рецепторной сигнализации и адаптивных ответах на гуморальные и нервные стимулы.</p>
        </section>

        <section style="margin-bottom: 25px;">
          <h4 style="color: var(--accent-pink); margin-bottom: 8px; font-size: 16px;">Клиническое значение и патологии</h4>
          <p>Любые деструктивные изменения, гипоксия или генетические аномалии данного звена приводят к развитию тяжелых синдромов. Клиническая верификация патологии проводится с помощью биохимических маркеров, ультразвуковых, рентгенологических и гистологических исследований. Терапия направлена на восстановление метаболической функции и предотвращение гибели клеток.</p>
        </section>
      </div>
      
      <div style="display: flex; gap: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-top: 20px;">
        ${node.organ ? `<button class="btn btn-primary" id="btn-article-modal-3d" style="margin: 0; padding: 10px 20px;">Открыть в 3D Атласе</button>` : ''}
        <button class="btn btn-outline" id="btn-article-modal-close" style="margin: 0; padding: 10px 20px;">Закрыть статью</button>
      </div>
    `;

    modal.classList.remove("hidden");
    setTimeout(() => {
      modal.style.opacity = "1";
      modal.querySelector("div").style.transform = "scale(1)";
    }, 10);

    const closeBtn = document.getElementById("btn-article-modal-close");
    if (closeBtn) {
      closeBtn.onclick = () => closeConceptArticleModal();
    }
    const go3d = document.getElementById("btn-article-modal-3d");
    if (go3d && node.organ) {
      go3d.onclick = () => {
        closeConceptArticleModal();
        navigateWiki("organ", node.organ, node.tab || "anatomy");
      };
    }
  }

  function closeConceptArticleModal() {
    const modal = document.getElementById("map-article-modal");
    if (!modal) return;
    modal.style.opacity = "0";
    modal.querySelector("div").style.transform = "scale(0.9)";
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 300);
  }

  function renderConceptTree(node, systemId) {
    const li = document.createElement("li");
    const card = document.createElement("div");
    
    let systemClass = systemId + "-node";
    
    card.className = `tree-node-card ${systemClass}`;
    card.textContent = node.name;
    
    card.onclick = (e) => {
      if (state.mapDragMoved) {
        state.mapDragMoved = false;
        return;
      }
      document.querySelectorAll(".tree-node-card").forEach(c => c.classList.remove("active-node"));
      card.classList.add("active-node");
      
      showConceptDetail(node);
      openConceptArticleModal(node);
    };
    
    li.appendChild(card);
    
    if (node.children && node.children.length > 0) {
      const ul = document.createElement("ul");
      node.children.forEach(child => {
        ul.appendChild(renderConceptTree(child, systemId));
      });
      li.appendChild(ul);
    }
    
    return li;
  }

  function showConceptDetail(node) {
    const detailCard = document.getElementById("map-detail-card");
    const titleEl = document.getElementById("map-detail-title");
    const descEl = document.getElementById("map-detail-desc");
    const goBtn = document.getElementById("map-detail-go-btn");
    
    if (!detailCard) return;
    
    titleEl.textContent = node.name;
    descEl.textContent = node.desc;
    
    if (goBtn) {
      if (node.organ) {
        goBtn.classList.remove("hidden");
        goBtn.onclick = () => {
          detailCard.classList.add("hidden");
          navigateWiki("organ", node.organ, node.tab || "anatomy");
        };
      } else {
        goBtn.classList.add("hidden");
      }
    }
    
    detailCard.classList.remove("hidden");
  }

  function initConceptMap() {
    const container = document.getElementById("concept-tree-root-container");
    if (!container) return;
    
    let activeSystemId = "cardiovascular";
    let mapScale = 1.0;
    let panX = 0;
    let panY = 0;
    
    function applyTransform() {
      container.style.transform = `translate(${panX}px, ${panY}px) scale(${mapScale})`;
    }

    function buildMap() {
      container.innerHTML = "";
      mapScale = 1.0;
      panX = 0;
      panY = 0;
      container.style.transform = "translate(0px, 0px) scale(1.0)";
      
      const mapData = MedData.conceptMaps[activeSystemId];
      if (!mapData || !mapData.root) return;
      
      const ul = document.createElement("ul");
      ul.appendChild(renderConceptTree(mapData.root, activeSystemId));
      container.appendChild(ul);
      
      const detailCard = document.getElementById("map-detail-card");
      if (detailCard) detailCard.classList.add("hidden");
    }
    
    document.querySelectorAll(".map-selector-btn").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(".map-selector-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        activeSystemId = btn.getAttribute("data-map-system");
        buildMap();
      };
    });
    
    const viewport = document.getElementById("map-tree-viewport");
    if (viewport) {
      const zoomInBtn = document.getElementById("map-zoom-in-btn");
      const zoomOutBtn = document.getElementById("map-zoom-out-btn");
      const resetBtn = document.getElementById("map-reset-btn");
      
      if (zoomInBtn) {
        zoomInBtn.onclick = () => {
          mapScale = Math.min(2.0, mapScale + 0.1);
          applyTransform();
        };
      }
      
      if (zoomOutBtn) {
        zoomOutBtn.onclick = () => {
          mapScale = Math.max(0.3, mapScale - 0.1);
          applyTransform();
        };
      }
      
      if (resetBtn) {
        resetBtn.onclick = () => {
          mapScale = 1.0;
          panX = 0;
          panY = 0;
          applyTransform();
        };
      }
      
      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const zoomStep = 0.05;
        if (e.deltaY < 0) {
          mapScale = Math.min(2.0, mapScale + zoomStep);
        } else {
          mapScale = Math.max(0.3, mapScale - zoomStep);
        }
        applyTransform();
      }, { passive: false });
    }
    
    const closeBtn = document.getElementById("map-detail-close");
    if (closeBtn) {
      closeBtn.onclick = () => {
        document.getElementById("map-detail-card").classList.add("hidden");
        document.querySelectorAll(".tree-node-card").forEach(c => c.classList.remove("active-node"));
      };
    }
    const modalCloseBtn = document.getElementById("map-article-close-btn");
    if (modalCloseBtn) {
      modalCloseBtn.onclick = () => {
        closeConceptArticleModal();
      };
    }
    
    if (viewport) {
      let isDown = false;
      let startClientX = 0, startClientY = 0;
      let startX = 0, startY = 0;
      
      viewport.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        isDown = true;
        state.mapDragMoved = false;
        viewport.style.cursor = "grabbing";
        startClientX = e.clientX;
        startClientY = e.clientY;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
      });
      
      viewport.addEventListener("mouseleave", () => {
        isDown = false;
        viewport.style.cursor = "grab";
      });
      
      viewport.addEventListener("mouseup", () => {
        isDown = false;
        viewport.style.cursor = "grab";
      });
      
      viewport.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        const dx = Math.abs(e.clientX - startClientX);
        const dy = Math.abs(e.clientY - startClientY);
        if (dx > 5 || dy > 5) {
          state.mapDragMoved = true;
        }
        e.preventDefault();
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
      });
    }
    
    buildMap();
  }

  // --- LAB ANALYZER ENGINE ---
  function initLabAnalyzer() {
    const labSkipBtn = document.getElementById("lab-skip-btn");
    const labNextBtn = document.getElementById("lab-next-btn");

    if (!labSkipBtn || !labNextBtn) return;

    // Reset controls
    labSkipBtn.onclick = () => { selectRandomLabCase(); };
    labNextBtn.onclick = () => { selectRandomLabCase(); };

    selectRandomLabCase();
  }

  function selectRandomLabCase() {
    if (!MedData.labs || MedData.labs.length === 0) return;
    
    let newIndex = state.currentLabIndex;
    if (MedData.labs.length > 1) {
      while (newIndex === state.currentLabIndex) {
        newIndex = Math.floor(Math.random() * MedData.labs.length);
      }
    } else {
      newIndex = 0;
    }
    state.currentLabIndex = newIndex;
    loadLabCase(newIndex);
  }

  function loadLabCase(index) {
    const labCase = MedData.labs[index];
    if (!labCase) return;

    const labSheetTitle = document.getElementById("lab-sheet-title");
    const labSheetDesc = document.getElementById("lab-sheet-desc");
    const labTableBody = document.getElementById("lab-table-body");
    const labOptionsContainer = document.getElementById("lab-options-container");
    const labFeedbackBox = document.getElementById("lab-feedback-box");
    const labPathogenesisContainer = document.getElementById("lab-pathogenesis-container");
    const labPathogenesisContent = document.getElementById("lab-pathogenesis-content");
    const labSkipBtn = document.getElementById("lab-skip-btn");
    const labNextBtn = document.getElementById("lab-next-btn");

    // Set texts
    if (labSheetTitle) labSheetTitle.textContent = labCase.title;
    if (labSheetDesc) labSheetDesc.textContent = labCase.description;

    // Reset UI visibility
    if (labFeedbackBox) {
      labFeedbackBox.classList.add("hidden");
      labFeedbackBox.innerHTML = "";
    }
    if (labPathogenesisContainer) {
      labPathogenesisContainer.classList.add("hidden");
    }
    if (labNextBtn) labNextBtn.classList.add("hidden");
    if (labSkipBtn) labSkipBtn.classList.remove("hidden");

    // Load table rows
    if (labTableBody) {
      labTableBody.innerHTML = "";
      labCase.parameters.forEach(param => {
        const tr = document.createElement("tr");
        
        let statusBadge = "";
        if (param.status === "HIGH") {
          statusBadge = `<span class="status-badge high">ВЫШЕ</span>`;
        } else if (param.status === "LOW") {
          statusBadge = `<span class="status-badge low">НИЖЕ</span>`;
        } else if (param.status === "ABNORMAL") {
          statusBadge = `<span class="status-badge abnormal">ПАТОЛОГИЯ</span>`;
        } else {
          statusBadge = `<span class="status-badge normal">НОРМА</span>`;
        }

        tr.innerHTML = `
          <td style="padding: 12px 10px; font-weight: 500;">${param.name}</td>
          <td style="padding: 12px 10px; text-align: center; font-weight: 700; color: ${param.status !== "NORMAL" ? "var(--accent-pink)" : "var(--text-color)"}">${param.value}</td>
          <td style="padding: 12px 10px; text-align: center; color: var(--text-muted);">${param.ref}</td>
          <td style="padding: 12px 10px; text-align: center; color: var(--text-muted);">${param.unit}</td>
          <td style="padding: 12px 10px; text-align: center;">${statusBadge}</td>
        `;

        // Row highlighting toggle
        tr.addEventListener("click", () => {
          tr.classList.toggle("lab-row-selected");
        });

        labTableBody.appendChild(tr);
      });
    }

    // Load multiple choice options
    if (labOptionsContainer) {
      labOptionsContainer.innerHTML = "";
      
      const allOptions = [labCase.correctAnswer, ...labCase.distractors];
      shuffleArray(allOptions);

      allOptions.forEach(optText => {
        const btn = document.createElement("button");
        btn.className = "lab-option-btn";
        btn.textContent = optText;

        btn.addEventListener("click", () => {
          if (optText === labCase.correctAnswer) {
            btn.classList.add("correct");
            
            document.querySelectorAll(".lab-option-btn").forEach(b => {
              b.disabled = true;
            });

            addXP(50);
            trackDailyAction("lab_solved");
            unlockAchievement("chief_laboratory_technician");

            if (labFeedbackBox) {
              labFeedbackBox.innerHTML = `✅ <strong>Правильно!</strong> Заключение поставлено абсолютно верно. Вы получили +50 XP.`;
              labFeedbackBox.className = "lab-feedback";
              labFeedbackBox.style.background = "rgba(16, 185, 129, 0.1)";
              labFeedbackBox.style.borderColor = "rgba(16, 185, 129, 0.2)";
              labFeedbackBox.style.color = "#a7f3d0";
              labFeedbackBox.classList.remove("hidden");
            }

            if (labPathogenesisContainer && labPathogenesisContent) {
              labPathogenesisContent.innerHTML = labCase.pathogenesis;
              labPathogenesisContainer.classList.remove("hidden");
              if (window.MathJax) {
                MathJax.typesetPromise();
              }
            }

            if (labNextBtn) labNextBtn.classList.remove("hidden");
            if (labSkipBtn) labSkipBtn.classList.add("hidden");

          } else {
            btn.classList.add("incorrect");
            btn.disabled = true;

            const widgetEl = document.querySelector(".lab-widget");
            if (widgetEl) {
              widgetEl.style.animation = "shake 0.4s ease";
              setTimeout(() => {
                widgetEl.style.animation = "";
              }, 400);
            }

            if (labFeedbackBox) {
              labFeedbackBox.innerHTML = `❌ <strong>Ошибка!</strong> Синдром не соответствует бланку. Обратите внимание на показатели с отклонениями и попробуйте еще раз.`;
              labFeedbackBox.className = "lab-feedback";
              labFeedbackBox.style.background = "rgba(239, 68, 68, 0.1)";
              labFeedbackBox.style.borderColor = "rgba(239, 68, 68, 0.2)";
              labFeedbackBox.style.color = "#fca5a5";
              labFeedbackBox.classList.remove("hidden");
            }
          }
        });

        labOptionsContainer.appendChild(btn);
      });
    }
  }

  // --- TEXTBOOK READER MODULE ---
  let readerState = {
    activeSubjectId: "anatomy",
    activeChapterIndex: 0,
    activeLang: "ru",
    fontSize: 15
  };

  const subjectBookMap = {
    anatomy: { ru: "sapin_anatomy", en: "grays_anatomy" },
    histology: { ru: "afanasiev_histology", en: "junqueira_histology" },
    physiology: { ru: "sudakov_physiology", en: "guyton_physiology" },
    biochemistry: { ru: "severin_biochemistry", en: "lippincott_biochemistry" },
    pathophysiology: { ru: "novitsky_pathophysiology", en: "mcphee_pathophysiology" },
    pathology: { ru: "strukov_pathology", en: "robbins_pathology" },
    pharmacology: { ru: "kharkevich_pharmacology", en: "rang_dale_pharmacology" }
  };

  function openBookReader(identifier) {
    const modal = document.getElementById("book-reader-modal");
    if (!modal) return;

    // Check if this is a direct PDF book
    const pdfBook = MedData.books.find(b => b.id === identifier && b.isPdf);
    if (pdfBook) {
      modal.classList.remove("hidden");
      const textBody = document.getElementById("book-text-body");
      if (textBody) {
        textBody.innerHTML = `<iframe src="${pdfBook.pdfUrl}" style="width:100%;height:80vh;border:none;background:white;"></iframe>`;
      }
      const tocSidebar = document.querySelector(".book-toc-sidebar");
      if (tocSidebar) tocSidebar.style.display = "none";
      
      const layout = document.querySelector(".book-reader-layout");
      if (layout) layout.style.gridTemplateColumns = "1fr";

      document.getElementById("reader-book-title").textContent = pdfBook.title;
      document.getElementById("reader-book-author").textContent = "Автор: " + pdfBook.author;
      document.getElementById("book-reader-close").onclick = () => {
        modal.classList.add("hidden");
        if (layout) layout.style.gridTemplateColumns = "300px 1fr";
        if (tocSidebar) tocSidebar.style.display = "flex";
      };
      return;
    }

    // Restore layouts for normal books
    const layout = document.querySelector(".book-reader-layout");
    if (layout) layout.style.gridTemplateColumns = "300px 1fr";
    const tocSidebar = document.querySelector(".book-toc-sidebar");
    if (tocSidebar) tocSidebar.style.display = "flex";

    const subjectId = identifier;
    readerState.activeSubjectId = subjectId;
    readerState.activeChapterIndex = 0;
    trackDailyAction("chapter_read");
    readerState.activeLang = "ru";

    document.getElementById("btn-lang-ru").classList.add("active");
    document.getElementById("btn-lang-en").classList.remove("active");
    
    const contentPane = document.getElementById("book-content-pane");
    if (contentPane) {
      contentPane.className = "book-content-area reader-theme-night";
    }
    document.querySelectorAll(".theme-dot").forEach(d => {
      if (d.getAttribute("data-theme") === "night") {
        d.classList.add("active");
        d.style.border = "2px solid var(--accent-cyan)";
      } else {
        d.classList.remove("active");
        d.style.border = "";
      }
    });

    const searchInput = document.getElementById("reader-search-input");
    if (searchInput) searchInput.value = "";
    document.getElementById("reader-search-clear").style.display = "none";
    document.getElementById("reader-search-results-count").textContent = "";

    modal.classList.remove("hidden");

    loadBookTOC();
    loadBookChapter(0);

    document.getElementById("book-reader-close").onclick = () => {
      modal.classList.add("hidden");
    };

    document.getElementById("btn-lang-ru").onclick = () => {
      switchReaderLang("ru");
    };
    document.getElementById("btn-lang-en").onclick = () => {
      switchReaderLang("en");
    };

    document.getElementById("btn-font-inc").onclick = () => {
      adjustReaderFont(1);
    };
    document.getElementById("btn-font-dec").onclick = () => {
      adjustReaderFont(-1);
    };

    document.querySelectorAll(".theme-dot").forEach(dot => {
      dot.onclick = () => {
        const theme = dot.getAttribute("data-theme");
        document.querySelectorAll(".theme-dot").forEach(d => {
          d.classList.remove("active");
          d.style.border = "";
        });
        dot.classList.add("active");
        dot.style.border = "2px solid var(--accent-cyan)";
        contentPane.className = `book-content-area reader-theme-${theme}`;
      };
    });

    if (searchInput) {
      searchInput.oninput = () => {
        const q = searchInput.value.trim();
        if (q.length > 0) {
          document.getElementById("reader-search-clear").style.display = "block";
          highlightTextInChapter(q);
        } else {
          document.getElementById("reader-search-clear").style.display = "none";
          document.getElementById("reader-search-results-count").textContent = "";
          loadBookChapter(readerState.activeChapterIndex);
        }
      };
      document.getElementById("reader-search-clear").onclick = () => {
        searchInput.value = "";
        document.getElementById("reader-search-clear").style.display = "none";
        document.getElementById("reader-search-results-count").textContent = "";
        loadBookChapter(readerState.activeChapterIndex);
      };
    }
  }

  function switchReaderLang(lang) {
    if (readerState.activeLang === lang) return;
    readerState.activeLang = lang;

    document.getElementById("btn-lang-ru").classList.toggle("active", lang === "ru");
    document.getElementById("btn-lang-en").classList.toggle("active", lang === "en");

    loadBookTOC();
    loadBookChapter(readerState.activeChapterIndex);
  }

  function loadBookTOC() {
    const tocList = document.getElementById("book-toc-list");
    if (!tocList) return;
    tocList.innerHTML = "";

    const bookKey = subjectBookMap[readerState.activeSubjectId][readerState.activeLang];
    const book = MedData.textbooks[bookKey];
    if (!book) return;

    document.getElementById("reader-book-title").textContent = book.title;
    document.getElementById("reader-book-author").textContent = "Автор: " + book.author;

    book.chapters.forEach((chap, idx) => {
      const li = document.createElement("li");
      li.className = `book-toc-item ${idx === readerState.activeChapterIndex ? 'active' : ''}`;
      li.textContent = chap.title.split(":")[0];
      li.title = chap.title;
      li.onclick = () => {
        document.querySelectorAll(".book-toc-item").forEach(item => item.classList.remove("active"));
        li.classList.add("active");
        readerState.activeChapterIndex = idx;
        loadBookChapter(idx);
      };
      tocList.appendChild(li);
    });
  }

  function loadBookChapter(chapterIdx) {
    const textBody = document.getElementById("book-text-body");
    if (!textBody) return;

    const bookKey = subjectBookMap[readerState.activeSubjectId][readerState.activeLang];
    const book = MedData.textbooks[bookKey];
    if (!book) return;

    const chapter = book.chapters[chapterIdx];
    if (!chapter) return;

    textBody.innerHTML = `<h3 style="margin-top:0; font-size:1.4rem; color:#fff; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px; margin-bottom:20px;">${chapter.title}</h3>` + chapter.content;
    textBody.style.fontSize = `${readerState.fontSize}px`;

    applyWikiLinks(textBody);

    if (window.MathJax) {
      MathJax.typesetPromise();
    }
  }

  function adjustReaderFont(amount) {
    readerState.fontSize = Math.max(12, Math.min(24, readerState.fontSize + amount));
    const textBody = document.getElementById("book-text-body");
    if (textBody) {
      textBody.style.fontSize = `${readerState.fontSize}px`;
    }
  }

  function highlightTextInChapter(query) {
    const textBody = document.getElementById("book-text-body");
    if (!textBody) return;

    const bookKey = subjectBookMap[readerState.activeSubjectId][readerState.activeLang];
    const book = MedData.textbooks[bookKey];
    const chapter = book.chapters[readerState.activeChapterIndex];
    textBody.innerHTML = `<h3 style="margin-top:0; font-size:1.4rem; color:#fff; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px; margin-bottom:20px;">${chapter.title}</h3>` + chapter.content;

    applyWikiLinks(textBody);

    const regex = new RegExp(`(${query})`, "gi");
    let matchCount = 0;

    function walkAndHighlight(node) {
      if (node.nodeType === 3) {
        const val = node.nodeValue;
        if (regex.test(val)) {
          const matches = val.match(regex);
          matchCount += matches ? matches.length : 0;
          
          const temp = document.createElement("div");
          temp.innerHTML = val.replace(regex, `<span class="search-highlight">$1</span>`);
          
          while (temp.firstChild) {
            node.parentNode.insertBefore(temp.firstChild, node);
          }
          node.parentNode.removeChild(node);
        }
      } else if (node.nodeType === 1 && node.nodeName !== "SCRIPT" && node.nodeName !== "STYLE" && !node.classList.contains("search-highlight")) {
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          walkAndHighlight(node.childNodes[i]);
        }
      }
    }

    walkAndHighlight(textBody);
    
    const resultsCountEl = document.getElementById("reader-search-results-count");
    if (resultsCountEl) {
      resultsCountEl.textContent = matchCount > 0 ? `Найдено: ${matchCount}` : "Не найдено";
    }

    if (window.MathJax) {
      MathJax.typesetPromise();
    }
  }

  // --- CLINICAL CALCULATOR ENGINE ---
  function initClinicalCalculator() {
    const calcTypeSelect = document.getElementById("calc-type-select");
    const calcAge = document.getElementById("calc-age");
    const calcWeight = document.getElementById("calc-weight");
    const calcHeight = document.getElementById("calc-height");
    const calcCreatinine = document.getElementById("calc-creatinine");
    const calcTargetDose = document.getElementById("calc-target-dose");

    if (!calcTypeSelect) return;

    const sliders = [calcAge, calcWeight, calcHeight, calcCreatinine, calcTargetDose];
    sliders.forEach(slider => {
      if (slider) {
        slider.oninput = () => {
          updateSliderLabels();
          recalculateClinicalFormula();
        };
      }
    });

    document.getElementsByName("calc-gender").forEach(radio => {
      radio.onchange = () => {
        const text = radio.value === "male" ? "Мужской" : "Женский";
        document.getElementById("val-gender-text").textContent = text;
        recalculateClinicalFormula();
      };
    });

    calcTypeSelect.onchange = () => {
      const type = calcTypeSelect.value;
      const heightGroup = document.getElementById("calc-height-group");
      const creatinineGroup = document.getElementById("calc-creatinine-group");
      const doseGroup = document.getElementById("calc-dose-group");

      if (type === "ckd-epi" || type === "cockcroft") {
        if (heightGroup) heightGroup.style.display = type === "cockcroft" ? "block" : "none";
        if (creatinineGroup) creatinineGroup.style.display = "block";
        if (doseGroup) doseGroup.style.display = "none";
      } else if (type === "bsa") {
        if (heightGroup) heightGroup.style.display = "block";
        if (creatinineGroup) creatinineGroup.style.display = "none";
        if (doseGroup) doseGroup.style.display = "block";
      } else if (type === "bmi") {
        if (heightGroup) heightGroup.style.display = "block";
        if (creatinineGroup) creatinineGroup.style.display = "none";
        if (doseGroup) doseGroup.style.display = "none";
      }

      recalculateClinicalFormula();
    };

    updateSliderLabels();
    recalculateClinicalFormula();
  }

  function updateSliderLabels() {
    const calcAge = document.getElementById("calc-age");
    const calcWeight = document.getElementById("calc-weight");
    const calcHeight = document.getElementById("calc-height");
    const calcCreatinine = document.getElementById("calc-creatinine");
    const calcTargetDose = document.getElementById("calc-target-dose");

    if (calcAge) document.getElementById("val-age").textContent = calcAge.value;
    if (calcWeight) document.getElementById("val-weight").textContent = calcWeight.value;
    if (calcHeight) document.getElementById("val-height").textContent = calcHeight.value;
    if (calcCreatinine) document.getElementById("val-creatinine").textContent = calcCreatinine.value;
    if (calcTargetDose) document.getElementById("val-target-dose").textContent = calcTargetDose.value;
  }

  function recalculateClinicalFormula() {
    const calcTypeSelect = document.getElementById("calc-type-select");
    if (!calcTypeSelect) return;
    const type = calcTypeSelect.value;

    const age = parseInt(document.getElementById("calc-age").value);
    const weight = parseInt(document.getElementById("calc-weight").value);
    const height = parseInt(document.getElementById("calc-height").value);
    const creatinine = parseInt(document.getElementById("calc-creatinine").value);
    const targetDose = parseInt(document.getElementById("calc-target-dose").value);
    
    let gender = "male";
    document.getElementsByName("calc-gender").forEach(r => {
      if (r.checked) gender = r.value;
    });

    const outputVal = document.getElementById("calc-output-val");
    const outputUnit = document.getElementById("calc-output-unit");
    const interpretationText = document.getElementById("calc-interpretation-text");
    const recommendationsText = document.getElementById("calc-recommendations-text");

    if (!outputVal) return;

    unlockAchievement("clinical_mathematician");
    trackDailyAction("calc_used");

    if (type === "ckd-epi") {
      const crMg = creatinine / 88.4;
      const k = (gender === "female") ? 0.7 : 0.9;
      const alpha = (gender === "female") ? -0.241 : -0.302;
      const genderMult = (gender === "female") ? 1.012 : 1.0;
      
      let val = 142 * Math.pow(Math.min(crMg / k, 1), alpha) * Math.pow(Math.max(crMg / k, 1), -1.200) * Math.pow(0.9938, age) * genderMult;
      val = Math.round(val);

      outputVal.textContent = val;
      outputUnit.textContent = "мл/мин/1.73м²";

      let stage = "";
      let desc = "";
      let recs = "";

      if (val >= 90) {
        stage = "G1 (Норма или высокая СКФ)";
        desc = "Функция почек не нарушена. Физиологический почечный кровоток полностью сбалансирован.";
        recs = "Регулярный контроль АД, диета с умеренным потреблением натрия. Ограничений по лекарствам нет.";
      } else if (val >= 60) {
        stage = "G2 (Незначительно сниженная СКФ)";
        desc = "Начальные проявления хронической болезни почек (ХБП) при наличии других маркеров повреждения.";
        recs = "Контроль суточной протеинурии, оптимизация контроля гликемии у больных СД и уровня АД.";
      } else if (val >= 45) {
        stage = "G3a (Умеренно сниженная СКФ)";
        desc = "ХБП 3 стадии (умеренная почечная дисфункция). Риск накопления гидрофильных препаратов.";
        recs = "Внимание: требуется коррекция дозировок выводимых почками лекарств (например, метформина, НПВС). Избегайте КТ-ангиографии с контрастом.";
      } else if (val >= 30) {
        stage = "G3b (Существенно сниженная СКФ)";
        desc = "Выраженная почечная недостаточность. Почки с трудом фильтруют метаболиты азота.";
        recs = "Строгий запрет на НПВС! Рекомендуется консультация нефролога. Коррекция доз антибиотиков и антикоагулянтов по СКФ.";
      } else if (val >= 15) {
        stage = "G4 (Тяжело сниженная СКФ)";
        desc = "Претерминальная почечная недостаточность. Высокий риск гиперкалиемии и ацидоза.";
        recs = "Подготовка к заместительной почечной терапии. Контроль калия и фосфора сыворотки крови. Исключить калийсберегающие диуретики.";
      } else {
        stage = "G5 (Терминальная почечная недостаточность)";
        desc = "Уремия. Отказ фильтрационной функции почек. Жизнеугрожающие задержки азота и калия.";
        recs = "Показан экстренный гемодиализ, перитонеальный диализ или трансплантация почки.";
      }

      interpretationText.innerHTML = `<span style="font-weight:bold; color:var(--accent-pink);">${stage}</span><br>${desc}`;
      recommendationsText.textContent = recs;

    } else if (type === "cockcroft") {
      let val = ((140 - age) * weight) / (72 * (creatinine / 88.4));
      if (gender === "female") val *= 0.85;
      val = Math.round(val * 10) / 10;

      outputVal.textContent = val;
      outputUnit.textContent = "мл/мин (Клиренс)";

      let interpret = "";
      let recs = "";
      if (val >= 90) {
        interpret = "Нормальный клиренс креатинина. Выведение метаболитов в пределах нормы.";
        recs = "Дозы лекарственных средств рассчитываются по стандартным протоколам.";
      } else if (val >= 60) {
        interpret = "Легкое снижение клиренса. Фильтрационный резерв почек слегка снижен.";
        recs = "С осторожностью назначать полные терапевтические дозы высокотоксичных препаратов.";
      } else if (val >= 30) {
        interpret = "Умеренное снижение клиренса. Скорость клубочковой экскреции снижена вдвое.";
        recs = "Внимание: скорректируйте дозу аминогликозидов, дигоксина и низкомолекулярных гепаринов!";
      } else {
        interpret = "Тяжелая почечная недостаточность по формуле Кокрофта-Голта.";
        recs = "Критический риск кумуляции лекарств. Рекомендуется отмена нефротоксичных средств.";
      }

      interpretationText.innerHTML = interpret;
      recommendationsText.textContent = recs;

    } else if (type === "bsa") {
      const bsa = Math.sqrt((weight * height) / 3600);
      const bsaRounded = Math.round(bsa * 100) / 100;
      const totalDose = Math.round(bsa * targetDose);

      outputVal.textContent = `${totalDose} мг`;
      outputUnit.textContent = `Общая доза (при BSA = ${bsaRounded} м²)`;

      interpretationText.innerHTML = `Площадь поверхности тела пациента составляет <strong style="color:var(--accent-cyan);">${bsaRounded} м²</strong>. <br>Расчетная доза препарата: <strong>${totalDose} мг</strong> (исходя из тарифа ${targetDose} мг/м²).`;
      recommendationsText.textContent = "Данный метод расчета является стандартом дозирования химиотерапевтических средств (онкология) и ряда педиатрических доз для минимизации токсического овердоза.";

    } else if (type === "bmi") {
      const heightM = height / 100;
      const bmi = weight / (heightM * heightM);
      const bmiRounded = Math.round(bmi * 10) / 10;

      const waterDeficit = Math.round(weight * 0.04 * 10) / 10;

      outputVal.textContent = bmiRounded;
      outputUnit.textContent = "Индекс массы тела (ИМТ)";

      let status = "";
      let color = "var(--accent-cyan)";
      if (bmiRounded < 18.5) {
        status = "Дефицит массы тела (дистрофия)";
        color = "var(--accent-pink)";
      } else if (bmiRounded < 25) {
        status = "Нормальная масса тела (эутрофия)";
        color = "#a7f3d0";
      } else if (bmiRounded < 30) {
        status = "Избыточная масса тела (предожирение)";
        color = "#fcd34d";
      } else {
        status = "Ожирение!";
        color = "var(--accent-pink)";
      }

      interpretationText.innerHTML = `<span style="font-weight:bold; color:${color};">${status}</span>.<br>Оценочный дефицит свободной воды при умеренном обезвоживании: <strong style="color:var(--accent-cyan);">${waterDeficit} л</strong>.`;
      recommendationsText.textContent = `При ИМТ = ${bmiRounded} риски метаболических и сердечно-сосудических осложнений оцениваются как ${bmiRounded >= 30 ? "повышенные" : "низкие"}. Регидратацию проводить изотоническими растворами под контролем диуреза.`;
    }
  }

  // --- UTILS ---
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // --- USER PROFILE & ACCOUNT CREATION ---
  state.userProfile = {
    username: "Doctor_House",
    specialty: "СГМУ, Лечебное дело",
    avatar: "🧑‍⚕️",
    motto: "Вся жизнь - борьба за гомеостаз!",
    level: 1,
    xp: 0,
    casesSolved: 0,
    quizzesSolved: 0,
    duelsWon: 0,
    forumPosts: 0
  };

  window.loadUserProfile = function() {
    // First, always try loading from local storage (works without backend)
    const stored = safeStorage.getItem("medstudy_user_profile");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        state.userProfile = parsed;
        state.level = parsed.level || 1;
        state.xp = parsed.xp || 0;
        initSocket();
      } catch(e) {
        console.warn("Профиль повреждён, сброс.");
        safeStorage.removeItem("medstudy_user_profile");
      }
    }

    // If no local profile exists, show account creation modal
    if (!safeStorage.getItem("medstudy_user_profile")) {
      const modal = document.getElementById("account-creation-modal");
      if (modal) modal.style.display = "flex";
    }

    syncSocialStats();
    renderProfileView();

    // Try to sync with backend in background (non-blocking)
    const token = safeStorage.getItem("medstudy_jwt_token");
    if (token) {
      fetch(`${API_URL}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          state.userProfile = data.user;
          state.level = data.user.level || state.level;
          state.xp = data.user.xp || state.xp;
          initSocket();
          saveUserProfile();
          renderProfileView();
        }
      })
      .catch(() => {});
    }
  };

  function saveUserProfile() {
    state.userProfile.level = state.level;
    state.userProfile.xp = state.xp;
    // Synchronous local save — always works
    safeStorage.setItem("medstudy_user_profile", JSON.stringify(state.userProfile));

    // Background sync with backend (fire and forget)
    const token = safeStorage.getItem("medstudy_jwt_token");
    if (token) {
      fetch(`${API_URL}/auth/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          xp: state.xp,
          level: state.level,
          studiedCardsCount: state.studiedCardsCount,
          solvedCasesCount: state.solvedCasesCount,
          completedTopicsCount: state.completedTopics ? state.completedTopics.length : 0
        })
      }).catch(() => {});
    }
  }

  function syncSocialStats() {
    state.userProfile.casesSolved = state.completedTopics ? state.completedTopics.filter(t => t.startsWith("case_")).length : 0;
    state.userProfile.quizzesSolved = state.completedTopics ? state.completedTopics.filter(t => t.startsWith("quiz_")).length : 0;
    
    const storedWon = safeStorage.getItem("medstudy_duels_won") || "0";
    state.userProfile.duelsWon = parseInt(storedWon);
    
    const storedPosts = safeStorage.getItem("medstudy_forum_posts_count") || "0";
    state.userProfile.forumPosts = parseInt(storedPosts);
    
    saveUserProfile();
  }

  // Account Creation Form handler
  const accForm = document.getElementById("account-creation-form");
  if (accForm) {
    accForm.onsubmit = (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById("acc-username");
      const specialtyInput = document.getElementById("acc-specialty");
      const mottoInput = document.getElementById("acc-motto");
      
      const selectedAvatarBtn = document.querySelector("#avatar-selector .avatar-opt.active");
      const avatarEmoji = selectedAvatarBtn ? selectedAvatarBtn.textContent.trim() : "🧑‍⚕️";
      
      const selectedColorBtn = document.querySelector("#namecolor-selector .color-opt.active");
      const nameColor = selectedColorBtn ? selectedColorBtn.getAttribute("data-color") : "#00f2fe";
      
      const username = (usernameInput && usernameInput.value.trim()) ? usernameInput.value.trim() : "Студент";
      const specialty = (specialtyInput && specialtyInput.value.trim()) ? specialtyInput.value.trim() : "Лечебное дело";
      const motto = (mottoInput && mottoInput.value.trim()) ? mottoInput.value.trim() : "Учеба и только учеба!";
      
      state.userProfile.username = username;
      state.userProfile.specialty = specialty;
      state.userProfile.motto = motto;
      state.userProfile.avatar = avatarEmoji;
      state.userProfile.nameColor = nameColor;
      state.userProfile.level = 1;
      state.userProfile.xp = 0;
      state.userProfile.casesSolved = 0;
      state.userProfile.quizzesSolved = 0;
      state.userProfile.duelsWon = 0;
      state.userProfile.forumPosts = 0;

      // Save locally IMMEDIATELY (synchronous, no await)
      saveUserProfile();
      
      // Close modal instantly
      const modal = document.getElementById("account-creation-modal");
      if (modal) modal.style.display = "none";
      
      updateProfileUI();
      renderProfileView();
      
      unlockAchievement("account_created");
      showToast("🎉 Аккаунт успешно создан! Добро пожаловать.");

      fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email: `${username.toLowerCase().replace(/\s+/g, "_")}@medstudy.hub`,
          password: `${username}123`,
          specialty,
          avatar: avatarEmoji
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          safeStorage.setItem("medstudy_jwt_token", data.token);
          if (data.user) {
            state.userProfile = data.user;
            saveUserProfile();
            renderProfileView();
          }
          initSocket();
        }
      })
      .catch(() => {});
    };
  }

  // Avatar choice handler
  document.querySelectorAll("#avatar-selector .avatar-opt").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#avatar-selector .avatar-opt").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });

  document.querySelectorAll("#namecolor-selector .color-opt").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#namecolor-selector .color-opt").forEach(b => {
        b.classList.remove("active");
        b.style.border = "2px solid transparent";
      });
      btn.classList.add("active");
      btn.style.border = "2px solid #fff";
    };
  });

  // Edit Profile button
  const editProfileBtn = document.getElementById("btn-edit-profile");
  if (editProfileBtn) {
    editProfileBtn.onclick = () => {
      const newMotto = prompt("Введите новый девиз/статус профиля:", state.userProfile.motto);
      if (newMotto !== null) {
        state.userProfile.motto = newMotto;
        saveUserProfile();
        renderProfileView();
        showToast("Статус профиля обновлен!");
      }
    };
  }

  // Logout button
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      safeStorage.removeItem("medstudy_user_profile");
      safeStorage.removeItem("medstudy_jwt_token");
      safeStorage.removeItem("medstudy_friends_list");
      window.location.reload();
    };
  }

  function renderProfileView() {
    const avatarEmoji = document.getElementById("prof-avatar-emoji");
    const username = document.getElementById("prof-username");
    const specialty = document.getElementById("prof-specialty");
    const motto = document.getElementById("prof-motto");
    const levelNum = document.getElementById("prof-level-num");
    const levelTitle = document.getElementById("prof-level-title");
    
    if (avatarEmoji) avatarEmoji.textContent = state.userProfile.avatar;
    if (username) {
      username.textContent = state.userProfile.username;
      if (state.userProfile.nameColor) {
        username.style.color = state.userProfile.nameColor;
        username.style.textShadow = `0 0 10px ${state.userProfile.nameColor}88`;
      }
    }
    if (specialty) specialty.textContent = state.userProfile.specialty;
    
    const profIdVal = document.getElementById("prof-id-val");
    if (profIdVal) {
      profIdVal.textContent = state.userProfile.id || "-";
    }
    const profIdContainer = document.getElementById("prof-id-container");
    if (profIdContainer && state.userProfile.id) {
      profIdContainer.onclick = () => {
        navigator.clipboard.writeText(state.userProfile.id);
        showToast("ID скопирован в буфер обмена!", "success");
      };
    }
    
    if (motto) motto.textContent = state.userProfile.motto;
    if (levelNum) levelNum.textContent = state.level;
    
    const totalXp = state.xp + (state.level - 1) * 500;
    let activeRank = RANKS[0].title;
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (totalXp >= RANKS[i].threshold) {
        activeRank = RANKS[i].title;
        break;
      }
    }
    if (levelTitle) levelTitle.textContent = activeRank;

    const casesCount = document.getElementById("stat-cases-count");
    const quizzesCount = document.getElementById("stat-quizzes-count");
    const duelsCount = document.getElementById("stat-duels-count");
    const forumCount = document.getElementById("stat-forum-count");

    if (casesCount) casesCount.textContent = state.userProfile.casesSolved;
    if (quizzesCount) quizzesCount.textContent = state.userProfile.quizzesSolved;
    if (duelsCount) duelsCount.textContent = state.userProfile.duelsWon;
    if (forumCount) forumCount.textContent = state.userProfile.forumPosts;

    renderAchievementsList();
  }

  function renderAchievementsList() {
    const listContainer = document.getElementById("profile-achievements-list");
    if (!listContainer) return;
    
    listContainer.innerHTML = "";
    
    const allAchievements = [
      { id: "account_created", title: "Первый шаг", desc: "Успешная регистрация в MedStudy Hub", icon: "🩺" },
      { id: "anatomy_explorer", title: "Исследователь органов", desc: "Просмотрено описание любого органа в Справочнике", icon: "🧠" },
      { id: "diagnostician_junior", title: "Начинающий терапевт", desc: "Решен 1 клинический случай", icon: "📝" },
      { id: "diagnostician_senior", title: "Светило медицины", desc: "Решено 5 клинических случаев", icon: "🎓" },
      { id: "cardiac_expert", title: "Ритмолог", desc: "Идеально расшифрован случай инфаркта миокарда", icon: "🫀" },
      { id: "clinical_mathematician", title: "Клинический математик", desc: "Произведен расчет параметров в калькуляторе", icon: "📊" },
      { id: "duel_victor", title: "Триумфатор дуэлей", desc: "Выиграна карточная дуэль у друга с сухим счетом", icon: "⚔️" },
      { id: "forum_contributor", title: "Научный корреспондент", desc: "Опубликован вопрос на врачебном консилиуме", icon: "💬" }
    ];

    allAchievements.forEach(ach => {
      const isUnlocked = state.achievements && state.achievements.includes(ach.id);
      
      const card = document.createElement("div");
      card.className = `profile-ach-card ${isUnlocked ? '' : 'locked'}`;
      card.style.cssText = `padding: 15px; border-radius: 8px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); display: flex; gap: 12px; align-items: center;`;
      
      card.innerHTML = `
        <div style="font-size: 26px; filter: ${isUnlocked ? 'none' : 'grayscale(1)'};">${ach.icon}</div>
        <div>
          <h4 style="margin: 0; font-size: 13.5px; color: ${isUnlocked ? '#fff' : 'var(--text-muted)'}; font-weight: bold;">${ach.title}</h4>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: var(--text-muted); line-height: 1.3;">${ach.desc}</p>
        </div>
      `;
      
      listContainer.appendChild(card);
    });
  }

  // --- CHATS & FRIENDS DATABASE ---
  const friendsList = [];

  state.activeFriendId = null;

  window.setupSocialSystem = function() {
    renderFriendsList();
    renderForumThreads();

    const chatForm = document.getElementById("chat-send-form");
    if (chatForm) {
      chatForm.onsubmit = (e) => {
        e.preventDefault();
        sendChatMessage();
      };
    }

    const btnDuel = document.getElementById("btn-chat-start-duel");
    if (btnDuel) {
      btnDuel.onclick = () => {
        if (state.activeFriendId) {
          if (socket && socket.connected) {
            socket.emit("invite_friend", { receiverId: state.activeFriendId, type: "duel" });
            showToast("Вызов на дуэль отправлен другу. Ожидайте ответа...", "success");
          } else {
            startCardDuel(state.activeFriendId);
          }
        }
      };
    }

    const btnCoop = document.getElementById("btn-chat-start-coop");
    if (btnCoop) {
      btnCoop.onclick = () => {
        if (state.activeFriendId) {
          if (socket && socket.connected) {
            socket.emit("invite_friend", { receiverId: state.activeFriendId, type: "coop" });
            showToast("Приглашение на совместный тест отправлено другу. Ожидайте ответа...", "success");
          } else {
            startCoopQuiz(state.activeFriendId);
          }
        }
      };
    }

    document.querySelectorAll(".forum-filters button").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(".forum-filters button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderForumThreads(btn.getAttribute("data-cat"));
      };
    });

    const createThreadForm = document.getElementById("forum-create-thread-form");
    if (createThreadForm) {
      createThreadForm.onsubmit = (e) => {
        e.preventDefault();
        submitNewForumThread();
      };
    }

    const btnBackList = document.getElementById("btn-forum-back");
    if (btnBackList) {
      btnBackList.onclick = () => {
        document.getElementById("forum-single-thread-pane").classList.add("hidden");
        document.getElementById("forum-threads-list-pane").classList.remove("hidden");
        document.getElementById("forum-new-thread-pane").classList.add("hidden");
      };
    }

    const btnNewBack = document.getElementById("btn-new-thread-back");
    if (btnNewBack) {
      btnNewBack.onclick = () => {
        document.getElementById("forum-single-thread-pane").classList.add("hidden");
        document.getElementById("forum-threads-list-pane").classList.remove("hidden");
        document.getElementById("forum-new-thread-pane").classList.add("hidden");
      };
    }

    const btnNewThread = document.getElementById("btn-forum-new-thread");
    if (btnNewThread) {
      btnNewThread.onclick = () => {
        document.getElementById("forum-single-thread-pane").classList.add("hidden");
        document.getElementById("forum-threads-list-pane").classList.add("hidden");
        document.getElementById("forum-new-thread-pane").classList.remove("hidden");
      };
    }

    const replyForm = document.getElementById("forum-reply-form");
    if (replyForm) {
      replyForm.onsubmit = (e) => {
        e.preventDefault();
        submitForumReply();
      };
    }

    // Share buttons in Calculator
    const calcShareChat = document.getElementById("btn-calc-share-chat");
    if (calcShareChat) {
      calcShareChat.onclick = () => {
        const val = document.getElementById("calc-output-val").textContent;
        const unit = document.getElementById("calc-output-unit").textContent;
        const interp = document.getElementById("calc-interpretation-text").innerText;
        if (val === "--") {
          showToast("Сделайте расчет перед отправкой!");
          return;
        }
        
        const friendId = state.activeFriendId || "sklif_anya";
        const messageText = `📊 Коллега, я произвел клинический расчет: значение = ${val} ${unit}. Заключение: ${interp}`;
        
        const friendObj = friendsList.find(f => f.id === friendId);
        if (friendObj) {
          friendObj.chatHistory.push({ sender: "sent", text: messageText, time: getFormattedTime() });
          showToast(`Расчет отправлен в чат к ${friendObj.name}!`);
          
          navigateToView("community");
          openChatWithFriend(friendId);
          
          triggerBotReply(friendId, messageText);
        }
      };
    }

    const calcShareForum = document.getElementById("btn-calc-share-forum");
    if (calcShareForum) {
      calcShareForum.onclick = () => {
        const val = document.getElementById("calc-output-val").textContent;
        const unit = document.getElementById("calc-output-unit").textContent;
        const interp = document.getElementById("calc-interpretation-text").innerText;
        if (val === "--") {
          showToast("Сделайте расчет перед публикацией!");
          return;
        }

        navigateToView("forum");
        document.getElementById("forum-threads-list-pane").classList.add("hidden");
        document.getElementById("forum-new-thread-pane").classList.remove("hidden");

        const qTitle = document.getElementById("new-thread-title");
        const qContent = document.getElementById("new-thread-content");
        const qCat = document.getElementById("new-thread-category");

        if (qTitle) qTitle.value = `Помогите оценить клинический расчет: ${val} ${unit}`;
        if (qCat) qCat.value = "cases";
        if (qContent) qContent.value = `Провел расчет по формуле. Результат: ${val} ${unit}.\nИнтерпретация: ${interp}\nНасколько критичны данные показатели в условиях палаты интенсивной терапии?`;
      };
    }
  };

  function renderFriendsList() {
    const container = document.getElementById("friends-container");
    if (!container) return;
    
    container.innerHTML = "";
    friendsList.forEach(friend => {
      const btn = document.createElement("button");
      btn.className = `friend-item-btn ${state.activeFriendId === friend.id ? 'active' : ''}`;
      
      let statusClass = "friend-status-dot";
      if (friend.status === "online") statusClass += " online";
      if (friend.status === "studying") statusClass += " studying";

      btn.innerHTML = `
        <div style="font-size: 24px;">${friend.avatar}</div>
        <div style="flex: 1; text-align: left;">
          <div style="font-size: 13.5px; font-weight: bold; color: #fff; display: flex; align-items: center; justify-content: space-between;">
            <span>${friend.name}</span>
            <span class="${statusClass}"></span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">${friend.statusText || friend.specialty || "В сети"}</div>
        </div>
      `;

      btn.onclick = () => {
        openChatWithFriend(friend.id);
      };

      container.appendChild(btn);
    });
  }

  window.openChatWithFriend = function(friendId) {
    state.activeFriendId = friendId;
    renderFriendsList();

    document.getElementById("comm-empty-state").classList.add("hidden");
    document.getElementById("comm-chat-active").classList.remove("hidden");
    document.getElementById("comm-duel-active").classList.add("hidden");
    document.getElementById("comm-coop-active").classList.add("hidden");

    const friend = friendsList.find(f => f.id === friendId);
    if (!friend) return;

    // Mark received messages from this friend as read locally
    friend.chatHistory.forEach(m => {
      if (m.sender === "received") m.isRead = true;
    });
    saveFriendsToStorage();

    // Emit read event to notify the friend
    if (socket && socket.connected) {
      socket.emit("read_messages", { senderId: friendId });
    }

    document.getElementById("chat-header-name").textContent = friend.name;
    document.getElementById("chat-header-avatar").textContent = friend.avatar;
    
    const statusLabel = document.getElementById("chat-header-status");
    statusLabel.textContent = friend.status === "online" ? "В сети" : (friend.specialty || "Не в сети");
    statusLabel.className = (friend.status === "online") ? "accent-cyan" : "text-muted";

    renderChatMessages();
  };

  function renderChatMessages() {
    const container = document.getElementById("chat-messages-container");
    if (!container) return;
    
    container.innerHTML = "";
    const friend = friendsList.find(f => f.id === state.activeFriendId);
    if (!friend) return;

    friend.chatHistory.forEach(msg => {
      const bubble = document.createElement("div");
      bubble.className = `chat-bubble ${msg.sender}`;
      const tickHtml = msg.sender === "sent"
        ? `<span style="margin-left: 4px; font-weight: bold; color: #030814; opacity: ${msg.isRead ? '1' : '0.45'};">${msg.isRead ? '✓✓' : '✓'}</span>`
        : '';
      bubble.innerHTML = `
        <div>${msg.text}</div>
        <div style="text-align: right; font-size: 9px; opacity: 0.6; margin-top: 4px; display: flex; justify-content: flex-end; align-items: center;">
          <span>${msg.time}</span>
          ${tickHtml}
        </div>
      `;
      container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
  }

  function getFormattedTime() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  }

  function initSocket() {
    if (typeof io === "undefined") return;

    if (!socket) {
      try {
        socket = io(BACKEND_URL, {
          reconnectionDelayMax: 10000,
        });
      } catch(e) {
        console.warn("Socket.io failed to initialize");
        return;
      }
    }

    const registerSocket = () => {
      console.log("[SOCKET] registerSocket() called. userProfile:", state.userProfile);
      if (state.userProfile && state.userProfile.id) {
        console.log("[SOCKET] Emitting register_connection for ID:", state.userProfile.id);
        socket.emit("register_connection", {
          id: state.userProfile.id,
          username: state.userProfile.username,
          nameColor: state.userProfile.nameColor || "#00f2fe"
        });
      }
    };

    if (socket.connected) {
      registerSocket();
    }

    socket.off("connect").on("connect", registerSocket);

    socket.off("receive_message").on("receive_message", (msg) => {
      console.log("[SOCKET] Client received receive_message payload:", msg);
      const friend = friendsList.find(f => f.id === msg.senderId || f.id === msg.receiverId);
      console.log("[SOCKET] Matching friend in list found:", friend);
      if (friend) {
        if (msg.senderId === state.userProfile.id) {
          const unconfirmed = friend.chatHistory.find(m => m.sender === "sent" && m.text === msg.text && m.isConfirmed === false);
          if (unconfirmed) {
            unconfirmed.time = msg.time;
            unconfirmed.isConfirmed = true;
            saveFriendsToStorage();
            if (state.activeFriendId === friend.id) {
              renderChatMessages();
            }
            return;
          }
          return; // Skip duplicate rendering for our own confirmed message
        }

        const isCurrentChatActive = (state.activeFriendId === friend.id);
        
        friend.chatHistory.push({
          sender: "received",
          text: msg.text,
          time: msg.time,
          isConfirmed: true,
          isRead: isCurrentChatActive
        });
        
        saveFriendsToStorage();

        if (isCurrentChatActive) {
          renderChatMessages();
          socket.emit("read_messages", { senderId: friend.id });
        } else {
          showToast(`📬 Новое сообщение от ${msg.senderName}: "${msg.text.substring(0, 30)}${msg.text.length > 30 ? '...' : ''}"`, "info", 6000);
        }
      }
    });

    socket.off("online_users").on("online_users", (onlineIds) => {
      console.log("[SOCKET] Received online users list:", onlineIds);
      friendsList.forEach(f => {
        f.status = onlineIds.includes(f.id) ? "online" : "offline";
      });
      renderFriendsList();
    });

    socket.off("user_presence").on("user_presence", (data) => {
      console.log("[SOCKET] Received user presence update:", data);
      const friend = friendsList.find(f => f.id === data.userId);
      if (friend) {
        friend.status = data.status;
        renderFriendsList();
      }
    });

    socket.off("messages_read").on("messages_read", (data) => {
      console.log("[SOCKET] Received messages_read for reader:", data.readerId);
      const friend = friendsList.find(f => f.id === data.readerId);
      if (friend) {
        friend.chatHistory.forEach(m => {
          if (m.sender === "sent") m.isRead = true;
        });
        saveFriendsToStorage();
        if (state.activeFriendId === data.readerId) {
          renderChatMessages();
        }
      }
    });

    socket.off("buddy_typing").on("buddy_typing", (data) => {
      const typingIndicator = document.getElementById("chat-typing-indicator");
      if (state.activeFriendId === data.buddyId && typingIndicator) {
        if (data.typing) {
          const typingFriend = friendsList.find(f => f.id === data.buddyId);
          const typingName = typingFriend ? typingFriend.name : "Друг";
          document.getElementById("chat-typing-text").textContent = `${typingName} печатает`;
          typingIndicator.classList.remove("hidden");
        } else {
          typingIndicator.classList.add("hidden");
        }
      }
    });

    socket.off("invite_received").on("invite_received", (data) => {
      showInviteModal(
        data.senderName,
        data.type,
        () => {
          socket.emit("accept_invite", { senderId: data.senderId, type: data.type });
        },
        () => {
          socket.emit("decline_invite", { senderId: data.senderId });
        }
      );
    });

    socket.off("invite_declined").on("invite_declined", (data) => {
      showToast(`Пользователь ${data.receiverName} отклонил приглашение.`, "warning");
    });

    socket.off("invite_error").on("invite_error", (data) => {
      showToast(data.message, "error");
    });

    socket.off("game_started").on("game_started", (data) => {
      state.activeLobbyId = data.lobbyId;
      state.activeLobbyType = data.type;
      
      showToast("Игра началась!", "success");

      const typingIndicator = document.getElementById("chat-typing-indicator");
      if (typingIndicator) typingIndicator.classList.add("hidden");

      if (data.type === "duel") {
        const partner = data.player1.id === state.userProfile.id ? data.player2 : data.player1;
        startCardDuelMultiplayer(partner.id, partner.name);
      } else {
        const partner = data.player1.id === state.userProfile.id ? data.player2 : data.player1;
        startCoopQuizMultiplayer(partner.id, partner.name);
      }
    });

    socket.off("game_state_update").on("game_state_update", (data) => {
      if (state.activeLobbyType === "duel" && state.duelState && state.duelState.active) {
        updateDuelStateMultiplayer(data.players);
      } else if (state.activeLobbyType === "coop" && state.coopState && state.coopState.active) {
        updateCoopStateMultiplayer(data.players);
      }
    });
  }

  function sendChatMessage() {
    const input = document.getElementById("chat-input-text");
    if (!input || input.value.trim() === "") return;

    const friend = friendsList.find(f => f.id === state.activeFriendId);
    if (!friend) return;

    const userText = input.value;
    const formattedTime = getFormattedTime();
    
    friend.chatHistory.push({
      sender: "sent",
      text: userText,
      time: formattedTime,
      isConfirmed: false
    });

    saveFriendsToStorage();

    input.value = "";
    renderChatMessages();

    if (socket) {
      console.log(`[SOCKET] Emitting send_message to receiver: ${friend.id}, text: "${userText}"`);
      socket.emit("send_message", {
        receiverId: friend.id,
        text: userText,
        time: formattedTime
      });
    } else {
      console.warn(`[SOCKET WARN] Cannot emit send_message. socket is null`);
      showToast("Сервис сообщений недоступен.", "error");
    }
  }

  function triggerBotReply(friendId, userText) {
    const typingIndicator = document.getElementById("chat-typing-indicator");
    const friend = friendsList.find(f => f.id === friendId);
    if (!friend) return;

    if (typingIndicator) {
      document.getElementById("chat-typing-text").textContent = `${friend.name} печатает`;
      typingIndicator.classList.remove("hidden");
    }

    const delay = 1500 + Math.random() * 2000;
    setTimeout(() => {
      if (typingIndicator) typingIndicator.classList.add("hidden");
      
      const response = generateBotResponse(friendId, userText);
      friend.chatHistory.push({
        sender: "received",
        text: response,
        time: getFormattedTime()
      });

      if (state.activeFriendId === friendId) {
        renderChatMessages();
      }
    }, delay);
  }

  function generateBotResponse(friendId, userText) {
    const text = userText.toLowerCase();
    
    if (friendId === "neuro_mary") {
      if (text.includes("привет")) {
        return "👋 Привет! Я как раз разбираю рефлекторную дугу. Знал ли ты, что у коленного рефлекса она моносинаптическая? Очень простой и быстрый путь!";
      }
      if (text.includes("мозг") || text.includes("синапс")) {
        return "🧠 Головной мозг содержит около 86 миллиардов нейронов, и каждый образует тысячи синапсов! При обучении синапсы укрепляются благодаря долгосрочной потенциации (LTP) рецепторов AMPA/NMDA.";
      }
      if (text.includes("почки") || text.includes("скф")) {
        return "🧠 Почки и мозг связаны регуляцией давления! Помнишь, что гипоталамус выделяет АДГ (вазопрессин) при повышении осмолярности плазмы, чтобы почки задерживали воду?";
      }
      if (text.includes("сердце") || text.includes("экг")) {
        return "❤️ Сердце регулируется вегетативной системой! Блуждающий нерв (n. vagus, X пара) выделяет ацетилхолин, действующий на M2-холинорецепторы SA-узла, вызывая брадикардию.";
      }
      return "🧠 Хм, очень интересный медицинский аспект. А ты знаешь, почему при инсульте в левом полушарии моторные нарушения развиваются именно в правой половине тела? Подсказка: пирамидный перекрест (decussatio pyramidum) в продолговатом мозге!";
    }

    if (friendId === "cardio_ivan") {
      if (text.includes("привет")) {
        return "🫀 Привет! Измеряю пульс перед экзаменом. Надеюсь, мой сердечный выброс в норме. Готов поболтать о гемодинамике!";
      }
      if (text.includes("сердце") || text.includes("инфаркт") || text.includes("экг")) {
        return "🫀 Самое важное при подозрении на ОИМ - снять ЭКГ в течение 10 минут! Элевация сегмента ST (инфаркт STEMI) говорит о трансмуральном повреждении миокарда. Срочно назначаем тромболизис или отправляем на ЧКВ!";
      }
      if (text.includes("давление") || text.includes("скф") || text.includes("почки")) {
        return "🫀 Сердечно-сосудистая система тесно связана с ренин-ангиотензин-альдостероновой системой (РААС). Почки снижают кровоток -> выделяют ренин -> ангиотензин II вызывает мощный вазоспазм и гипертензию!";
      }
      return "🫀 Интересно! А ты помнишь, какова нормальная длительность интервала PQ (PR) на ЭКГ? В норме она составляет 0.12 - 0.20 секунд. Удлинение указывает на АВ-блокаду I степени!";
    }

    if (friendId === "pathphys_dmitry") {
      if (text.includes("привет")) {
        return "🔬 Привет! Настраиваю микроскоп, смотрю биопсию миокарда с клетками Аничкова (ревмокардит). Что обсуждаем?";
      }
      if (text.includes("диагноз") || text.includes("кейс") || text.includes("клинический")) {
        return "🔬 Патологическая физиология - ключ к любому диагнозу! Сначала ищи этиопатогенез, потом ведущий патологический синдром, а симптомы - лишь верхушка айсберга.";
      }
      if (text.includes("фарма") || text.includes("препарат")) {
        return "🔬 Вся фармакология борется с патофизиологическими процессами. Например, НПВС блокируют ЦОГ-1 и ЦОГ-2, тем самым снижая синтез простагландинов и подавляя экссудативную фазу воспаления.";
      }
      return "🔬 С точки зрения патологии, это интригующе. Кстати, ответь на вопрос: какой тип некроза характерен для головного мозга при ишемическом инсульте? Колликвационный (влажный) или коагуляционный (сухой)?";
    }

    if (friendId === "sklif_anya") {
      if (text.includes("привет")) {
        return "🩺 Привет! Я на дежурстве, пишу истории болезни. Если у тебя есть сложные тесты, кидай сюда, решим вместе!";
      }
      if (text.includes("реанимация") || text.includes("газы") || text.includes("анализ")) {
        return "🩺 В реанимации газы крови (КОС) - Библия! Если pH < 7.35 и pCO2 > 45 мм рт.ст., это классический респираторный ацидоз. Нужно увеличивать минутный объем вентиляции на ИВЛ.";
      }
      if (text.includes("почки") || text.includes("моча")) {
        return "🩺 Острая почечная недостаточность (ОПП) определяется по темпу диуреза (менее 0.5 мл/кг/ч за 6 часов) и росту креатинина сыворотки. Следи за гиперкалиемией - она может остановить сердце!";
      }
      return "🩺 Коллега, давай держаться вместе! Нам нужно сдавать колоквиумы. Ты знаешь, каков первый шаг при анафилактическом шоке? Немедленное введение адреналина (эпинефрина) внутримышечно в дозе 0.3-0.5 мг!";
    }

    if (friendId === "pharma_kirill") {
      if (text.includes("привет")) {
        return "💊 Привет! Сортирую рецептурные бланки. Обсудим фармакокинетику или побочные эффекты лекарств?";
      }
      if (text.includes("фарма") || text.includes("рецепт") || text.includes("препарат")) {
        return "💊 Превосходно! Давай вспомним: бета-блокаторы делятся на селективные (метопролол, бисопролол - действуют на B1) и неселективные (пропранолол - блокируют B1 и B2, опасны при бронхиальной астме из-за бронхоспазма!).";
      }
      if (text.includes("печень") || text.includes("фермент")) {
        return "💊 Печень - главный орган биотрансформации! Цитохром P450 (в частности CYP3A4) метаболизирует 50% всех лекарств. Грейпфрутовый сок ингибирует этот фермент, вызывая передозировку препаратов!";
      }
      return "💊 Фармакология - наука точная. А ты помнишь разницу между агонистом и антагонистом? Агонист стимулирует рецептор, вызывая биологический ответ, а антагонист лишь блокирует связывание с естественным лигандом.";
    }

    return "🔬 Медицинский факт: мозг человека потребляет около 20% всей энергии организма, хотя составляет лишь 2% от массы тела. Отличная тема для обсуждения!";
  }

  // --- CARD DUEL SYSTEM ---
  window.startCardDuel = function(partnerId) {
    const friend = friendsList.find(f => f.id === partnerId);
    if (!friend) return;

    const duelTerms = [
      { term: "Ацетилхолин", cat: "Фармакология", def: "Основной нейромедиатор парасимпатической нервной системы, действующий на мускариновые и никотиновые рецепторы." },
      { term: "Нефрон", cat: "Анатомия", def: "Структурно-функциональная единица почки, состоящая из почечного тельца и системы канальцев." },
      { term: "Фракция выброса", cat: "Кардиология", def: "Показатель насосной функции сердца, отношение ударного объема к конечно-диастолическому объему левого желудочка (норма >50%)." },
      { term: "Гипоксия", cat: "Патофизиология", def: "Типовой патологический процесс, характеризующийся недостаточным снабжением тканей кислородом или нарушением его усвоения." },
      { term: "Почечный клиренс", cat: "Нефрология", def: "Объем плазмы крови, полностью очищаемый почками от какого-либо вещества за единицу времени." }
    ];

    state.duelState = {
      active: true,
      partnerId: partnerId,
      currentCardIndex: 0,
      scoreUser: 0,
      scorePartner: 0,
      cards: duelTerms
    };

    document.getElementById("comm-chat-active").classList.add("hidden");
    document.getElementById("comm-duel-active").classList.remove("hidden");
    document.getElementById("duel-partner-name").textContent = friend.name;

    updateDuelCard();
  };

  function updateDuelCard() {
    const ds = state.duelState;
    if (ds.currentCardIndex >= ds.cards.length) {
      finishCardDuel();
      return;
    }

    const card = ds.cards[ds.currentCardIndex];
    document.getElementById("duel-score-user").textContent = ds.scoreUser;
    document.getElementById("duel-score-partner").textContent = ds.scorePartner;

    const termCat = document.getElementById("duel-card-term-category");
    const term = document.getElementById("duel-card-term");
    const def = document.getElementById("duel-card-def");

    if (termCat) termCat.textContent = card.cat;
    if (term) term.textContent = card.term;
    if (def) {
      def.textContent = card.def;
      def.classList.add("hidden");
    }

    const flipBtn = document.getElementById("btn-duel-flip-card");
    if (flipBtn) flipBtn.classList.remove("hidden");

    document.getElementById("duel-partner-action-text").textContent = "Ожидание вашего ответа...";

    const failBtn = document.getElementById("btn-duel-fail");
    const successBtn = document.getElementById("btn-duel-success");
    if (failBtn) failBtn.disabled = false;
    if (successBtn) successBtn.disabled = false;
  }

  const flipBtn = document.getElementById("btn-duel-flip-card");
  if (flipBtn) {
    flipBtn.onclick = () => {
      const def = document.getElementById("duel-card-def");
      if (def) def.classList.remove("hidden");
      flipBtn.classList.add("hidden");
    };
  }

  const duelFail = document.getElementById("btn-duel-fail");
  if (duelFail) {
    duelFail.onclick = () => {
      handleDuelAnswer(false);
    };
  }

  const duelSuccess = document.getElementById("btn-duel-success");
  if (duelSuccess) {
    duelSuccess.onclick = () => {
      handleDuelAnswer(true);
    };
  }

  function handleDuelAnswer(userKnows) {
    const ds = state.duelState;
    if (!ds.active) return;

    document.getElementById("btn-duel-fail").disabled = true;
    document.getElementById("btn-duel-success").disabled = true;

    if (ds.isMultiplayer) {
      if (socket && socket.connected) {
        socket.emit("game_action", {
          lobbyId: ds.lobbyId,
          isCorrect: userKnows
        });
      }
      return;
    }

    if (userKnows) {
      ds.scoreUser++;
      document.getElementById("duel-score-user").textContent = ds.scoreUser;
    }

    const partner = friendsList.find(f => f.id === ds.partnerId);
    const partnerName = partner ? partner.name : "Бот";

    const actionText = document.getElementById("duel-partner-action-text");
    actionText.textContent = `${partnerName} думает...`;

    setTimeout(() => {
      const partnerKnows = Math.random() < 0.75;
      if (partnerKnows) {
        ds.scorePartner++;
        document.getElementById("duel-score-partner").textContent = ds.scorePartner;
        actionText.textContent = `${partnerName} ответил правильно! ✅`;
      } else {
        actionText.textContent = `${partnerName} ошибся! ❌`;
      }

      setTimeout(() => {
        ds.currentCardIndex++;
        updateDuelCard();
      }, 1500);
    }, 1000);
  }

  function finishCardDuel() {
    const ds = state.duelState;
    ds.active = false;
    
    const partner = friendsList.find(f => f.id === ds.partnerId);
    const partnerName = partner ? partner.name : "Друг";

    let resultMsg = "";
    let xpEarned = 0;

    if (ds.scoreUser > ds.scorePartner) {
      resultMsg = `🏆 Вы победили в дуэли против ${partnerName} со счетом ${ds.scoreUser}:${ds.scorePartner}!`;
      xpEarned = 100;
      
      const storedWon = parseInt(safeStorage.getItem("medstudy_duels_won") || "0") + 1;
      safeStorage.setItem("medstudy_duels_won", storedWon);
      
      if (ds.scoreUser === 5 && ds.scorePartner === 0) {
        unlockAchievement("duel_victor");
      }
      trackDailyAction("duel_won");
    } else if (ds.scoreUser < ds.scorePartner) {
      resultMsg = `😞 Вы проиграли дуэль против ${partnerName} со счетом ${ds.scoreUser}:${ds.scorePartner}. Попробуйте еще раз!`;
      xpEarned = 25;
    } else {
      resultMsg = `🤝 Ничья! Счет ${ds.scoreUser}:${ds.scorePartner}. Хорошая работа!`;
      xpEarned = 50;
    }

    showToast(`${resultMsg} (+${xpEarned} XP)`, "success", 5000);
    addXP(xpEarned);
    syncSocialStats();

    openChatWithFriend(ds.partnerId);
  }

  // --- COOPERATIVE QUIZ SYSTEM ---
  function seededShuffleOptions(options, seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    const random = () => {
      let x = Math.sin(h++) * 10000;
      return x - Math.floor(x);
    };

    const mapped = options.map((item, idx) => ({ item, r: random(), originalIdx: idx }));
    mapped.sort((a, b) => a.r - b.r);

    return {
      shuffledOpts: mapped.map(x => x.item),
      newAnsIndex: mapped.findIndex(x => x.originalIdx === 0)
    };
  }

  window.startCoopQuiz = function(partnerId) {
    const friend = friendsList.find(f => f.id === partnerId);
    if (!friend) return;

    const rawQuestions = [
      { q: "Какой из перечисленных ферментов лизосом активируется при ацидозе в очаге воспаления?", opts: ["Кислая фосфатаза", "Щелочная фосфатаза", "Амилаза", "Каталаза"], ans: 0, hint: "Помни про приставку - кислая среда соответствует ацидозу!" },
      { q: "Какое лекарственное вещество блокирует мускариновые холинорецепторы SA-узла?", opts: ["Атропин", "Пропранолол", "Пилокарпин", "Ацетилхолин"], ans: 0, hint: "Атропин - классический М-холиноблокатор, вызывающий тахикардию." },
      { q: "При каком уровне СКФ диагностируется терминальная хроническая болезнь почек (ХБП 5 стадии)?", opts: ["Менее 15 мл/мин/1.73м²", "Менее 30 мл/мин/1.73м²", "Менее 45 мл/мин/1.73м²", "Менее 60 мл/мин/1.73м²"], ans: 0, hint: "Это крайняя стадия, перед гемодиализом. Точно менее 15!" },
      { q: "Какой синдром характеризуется повышением pH артериальной крови более 7.45 и накоплением бикарбоната?", opts: ["Метаболический алкалоз", "Респираторный ацидоз", "Метаболический ацидоз", "Респираторный алкалоз"], ans: 0, hint: "pH > 7.45 - это алкалоз. Раз дело в бикарбонате - метаболический." },
      { q: "Как называется сухой некроз миокарда, возникающий в результате ишемии?", opts: ["Коагуляционный некроз", "Колликвационный некроз", "Гангрена", "Секвестр"], ans: 0, hint: "Для сердца и плотных паренхиматозных органов характерен именно коагуляционный!" },
      { q: "Что из перечисленного является основным маркером инфаркта миокарда?", opts: ["Тропонин I", "АСТ", "ЛДГ", "Миоглобин"], ans: 0, hint: "Этот белок наиболее специфичен для сердечной мышцы." },
      { q: "Какой класс антител первым синтезируется при первичном иммунном ответе?", opts: ["IgM", "IgG", "IgA", "IgE"], ans: 0, hint: "Они образуют пентамеры и появляются первыми." },
      { q: "Основной механизм действия нестероидных противовоспалительных препаратов?", opts: ["Ингибирование ЦОГ", "Стимуляция ЦОГ", "Ингибирование фосфолипазы А2", "Блокада гистаминовых рецепторов"], ans: 0, hint: "Они нарушают синтез простагландинов из арахидоновой кислоты." },
      { q: "Где в клетке происходит цикл Кребса (цикл трикарбоновых кислот)?", opts: ["В матриксе митохондрий", "В цитозоле", "В лизосомах", "На рибосомах"], ans: 0, hint: "Это происходит в 'энергетических станциях' клетки." },
      { q: "Какая аминокислота является предшественником серотонина?", opts: ["Триптофан", "Тирозин", "Глутамат", "Глицин"], ans: 0, hint: "Из нее также синтезируется мелатонин." },
      { q: "Какой гормон вырабатывается парафолликулярными (С-клетками) щитовидной железы?", opts: ["Кальцитонин", "Тироксин", "Трийодтиронин", "Паратгормон"], ans: 0, hint: "Этот гормон снижает уровень кальция в крови." },
      { q: "Какой микроорганизм наиболее часто вызывает язвенную болезнь желудка?", opts: ["Helicobacter pylori", "Escherichia coli", "Staphylococcus aureus", "Salmonella enterica"], ans: 0, hint: "Эта бактерия способна выживать в кислой среде желудка." },
      { q: "Что означает термин 'анизоцитоз'?", opts: ["Изменение размеров эритроцитов", "Изменение формы эритроцитов", "Снижение количества гемоглобина", "Увеличение количества лейкоцитов"], ans: 0, hint: "Приставка 'анизо' означает неравный, а 'цитоз' - относящийся к клеткам." },
      { q: "Какая кость НЕ относится к лицевому черепу?", opts: ["Клиновидная кость", "Верхняя челюсть", "Скуловая кость", "Носовая кость"], ans: 0, hint: "Эта кость образует основание черепа и похожа на бабочку." },
      { q: "Какой витамин необходим для нормального свертывания крови?", opts: ["Витамин К", "Витамин С", "Витамин А", "Витамин Е"], ans: 0, hint: "Он участвует в гамма-карбоксилировании факторов свертывания II, VII, IX, X." }
    ];

    const seed = Math.random().toString();
    const coopQuestions = rawQuestions.map((q, idx) => {
      const { shuffledOpts, newAnsIndex } = seededShuffleOptions(q.opts, seed + "_" + idx);
      return {
        q: q.q,
        opts: shuffledOpts,
        ans: newAnsIndex,
        hint: q.hint
      };
    });

    state.coopState = {
      active: true,
      partnerId: partnerId,
      currentQIndex: 0,
      scoreUser: 0,
      scorePartner: 0,
      questions: coopQuestions
    };

    document.getElementById("comm-chat-active").classList.add("hidden");
    document.getElementById("comm-coop-active").classList.remove("hidden");
    document.getElementById("coop-partner-name").textContent = friend.name;
    document.getElementById("coop-partner-progress-label").textContent = `${friend.name}:`;

    updateCoopQuestion();
  };

  function updateCoopQuestion() {
    const cs = state.coopState;
    if (cs.currentQIndex >= cs.questions.length) {
      finishCoopQuiz();
      return;
    }

    const qObj = cs.questions[cs.currentQIndex];
    document.getElementById("coop-q-counter").textContent = `Вопрос ${cs.currentQIndex + 1} из ${cs.questions.length}`;
    
    const userPercent = (cs.currentQIndex / cs.questions.length) * 100;
    const partnerPercent = (cs.currentQIndex / cs.questions.length) * 100;
    document.getElementById("coop-progress-user").style.width = `${userPercent}%`;
    document.getElementById("coop-progress-partner").style.width = `${partnerPercent}%`;
    
    document.getElementById("coop-score-user").textContent = `${cs.scoreUser}/${cs.currentQIndex}`;
    document.getElementById("coop-score-partner").textContent = `${cs.scorePartner}/${cs.currentQIndex}`;

    document.getElementById("coop-question-text").textContent = qObj.q;

    const partner = friendsList.find(f => f.id === cs.partnerId);
    document.getElementById("coop-hint-author").textContent = partner ? partner.name : "Друг";
    document.getElementById("coop-hint-text").textContent = qObj.hint;

    const optContainer = document.getElementById("coop-options-container");
    optContainer.innerHTML = "";

    qObj.opts.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-outline w-full";
      btn.style.cssText = "text-align: left; padding: 10px 15px; font-size: 13px; font-weight: 500;";
      btn.textContent = opt;
      btn.onclick = () => {
        handleCoopAnswer(idx);
      };
      optContainer.appendChild(btn);
    });
  }

  function handleCoopAnswer(selectedIdx) {
    const cs = state.coopState;
    if (!cs.active) return;

    document.querySelectorAll("#coop-options-container button").forEach(btn => {
      btn.disabled = true;
    });

    const qObj = cs.questions[cs.currentQIndex];
    const correctIdx = qObj.ans;
    
    const optionButtons = document.querySelectorAll("#coop-options-container button");
    const isCorrect = selectedIdx === correctIdx;
    
    if (isCorrect) {
      cs.scoreUser++;
      optionButtons[selectedIdx].style.background = "#10b981";
      optionButtons[selectedIdx].style.borderColor = "#10b981";
      optionButtons[selectedIdx].style.color = "#fff";
    } else {
      optionButtons[selectedIdx].style.background = "#ef4444";
      optionButtons[selectedIdx].style.borderColor = "#ef4444";
      optionButtons[selectedIdx].style.color = "#fff";
      
      optionButtons[correctIdx].style.background = "#10b981";
      optionButtons[correctIdx].style.borderColor = "#10b981";
      optionButtons[correctIdx].style.color = "#fff";
    }

    if (cs.isMultiplayer) {
      if (socket && socket.connected) {
        socket.emit("game_action", {
          lobbyId: cs.lobbyId,
          isCorrect: isCorrect
        });
      }
      return;
    }

    document.getElementById("coop-score-user").textContent = `${cs.scoreUser}/${cs.currentQIndex + 1}`;

    setTimeout(() => {
      const partnerCorrect = Math.random() < 0.8;
      if (partnerCorrect) {
        cs.scorePartner++;
      }
      document.getElementById("coop-score-partner").textContent = `${cs.scorePartner}/${cs.currentQIndex + 1}`;

      const nextUserPercent = ((cs.currentQIndex + 1) / cs.questions.length) * 100;
      document.getElementById("coop-progress-user").style.width = `${nextUserPercent}%`;
      document.getElementById("coop-progress-partner").style.width = `${nextUserPercent}%`;

      setTimeout(() => {
        cs.currentQIndex++;
        updateCoopQuestion();
      }, 2000);
    }, 800);
  }

  function finishCoopQuiz() {
    const cs = state.coopState;
    cs.active = false;
    
    const partner = friendsList.find(f => f.id === cs.partnerId);
    const partnerName = partner ? partner.name : "Друг";

    const totalXp = (cs.scoreUser + cs.scorePartner) * 15;
    trackDailyAction("coop_quiz_solved");
    showToast(`🎉 Кооп-тест завершен! Вы: ${cs.scoreUser} ✅ | ${partnerName}: ${cs.scorePartner} ✅ | Совместно: +${totalXp} XP!`, "success", 5000);
    
    addXP(totalXp);
    syncSocialStats();

    state.activeLobbyId = null;
    state.activeLobbyType = null;

    openChatWithFriend(cs.partnerId);
  }

  function startCardDuelMultiplayer(partnerId, partnerName) {
    const duelTerms = [
      { term: "Ацетилхолин", cat: "Фармакология", def: "Основной нейромедиатор парасимпатической нервной системы, действующий на мускариновые и никотиновые рецепторы." },
      { term: "Нефрон", cat: "Анатомия", def: "Структурно-функциональная единица почки, состоящая из почечного тельца и системы канальцев." },
      { term: "Фракция выброса", cat: "Кардиология", def: "Показатель насосной функции сердца, отношение ударного объема к конечно-диастолическому объему левого желудочка (норма >50%)." },
      { term: "Гипоксия", cat: "Патофизиология", def: "Типовой патологический процесс, характеризующийся недостаточным снабжением тканей кислородом или нарушением его усвоения." },
      { term: "Почечный клиренс", cat: "Нефрология", def: "Объем плазмы крови, полностью очищаемый почками от какого-либо вещества за единицу времени." }
    ];

    state.duelState = {
      active: true,
      isMultiplayer: true,
      lobbyId: state.activeLobbyId,
      partnerId: partnerId,
      currentCardIndex: 0,
      scoreUser: 0,
      scorePartner: 0,
      cards: duelTerms
    };

    document.getElementById("comm-chat-active").classList.add("hidden");
    document.getElementById("comm-duel-active").classList.remove("hidden");
    document.getElementById("duel-partner-name").textContent = partnerName;

    updateDuelCard();
  }

  function updateDuelStateMultiplayer(players) {
    const ds = state.duelState;
    if (!ds || !ds.active) return;

    const myId = state.userProfile.id;
    const partnerId = Object.keys(players).find(id => id !== myId);

    const me = players[myId];
    const partner = players[partnerId];

    if (!me || !partner) return;

    ds.scoreUser = me.score;
    ds.scorePartner = partner.score;

    document.getElementById("duel-score-user").textContent = ds.scoreUser;
    document.getElementById("duel-score-partner").textContent = ds.scorePartner;

    const actionText = document.getElementById("duel-partner-action-text");
    
    if (me.currentIdx > partner.currentIdx) {
      actionText.textContent = `Ожидание хода ${partner.name}...`;
    } else if (partner.currentIdx > me.currentIdx) {
      actionText.textContent = `${partner.name} сделал ход! Ваша очередь.`;
      const failBtn = document.getElementById("btn-duel-fail");
      const successBtn = document.getElementById("btn-duel-success");
      const flipBtn = document.getElementById("btn-duel-flip-card");
      if (failBtn && failBtn.disabled && me.currentIdx === ds.currentCardIndex) {
        failBtn.disabled = false;
        successBtn.disabled = false;
        if (flipBtn) flipBtn.classList.remove("hidden");
      }
    } else {
      if (me.currentIdx > ds.currentCardIndex) {
        actionText.textContent = `Оба игрока ответили!`;
        setTimeout(() => {
          ds.currentCardIndex = me.currentIdx;
          updateDuelCard();
        }, 1500);
      } else {
        actionText.textContent = `Раунд #${me.currentIdx + 1}. Ожидание ответов...`;
      }
    }
  }

  function startCoopQuizMultiplayer(partnerId, partnerName) {
    const rawQuestions = [
      { q: "Какой из перечисленных ферментов лизосом активируется при ацидозе в очаге воспаления?", opts: ["Кислая фосфатаза", "Щелочная фосфатаза", "Амилаза", "Каталаза"], ans: 0, hint: "Помни про приставку - кислая среда соответствует ацидозу!" },
      { q: "Какое лекарственное вещество блокирует мускариновые холинорецепторы SA-узла?", opts: ["Атропин", "Пропранолол", "Пилокарпин", "Ацетилхолин"], ans: 0, hint: "Атропин - классический М-холиноблокатор, вызывающий тахикардию." },
      { q: "При каком уровне СКФ диагностируется терминальная хроническая болезнь почек (ХБП 5 стадии)?", opts: ["Менее 15 мл/мин/1.73м²", "Менее 30 мл/мин/1.73м²", "Менее 45 мл/мин/1.73м²", "Менее 60 мл/мин/1.73м²"], ans: 0, hint: "Это крайняя стадия, перед гемодиализом. Точно менее 15!" },
      { q: "Какой синдром характеризуется повышением pH артериальной крови более 7.45 и накоплением бикарбоната?", opts: ["Метаболический алкалоз", "Респираторный ацидоз", "Метаболический ацидоз", "Респираторный алкалоз"], ans: 0, hint: "pH > 7.45 - это алкалоз. Раз дело в бикарбонате - метаболический." },
      { q: "Как называется сухой некроз миокарда, возникающий в результате ишемии?", opts: ["Коагуляционный некроз", "Колликвационный некроз", "Гангрена", "Секвестр"], ans: 0, hint: "Для сердца и плотных паренхиматозных органов характерен именно коагуляционный!" }
    ];

    const seed = state.activeLobbyId || "coop_multi";
    const coopQuestions = rawQuestions.map((q, idx) => {
      const { shuffledOpts, newAnsIndex } = seededShuffleOptions(q.opts, seed + "_" + idx);
      return {
        q: q.q,
        opts: shuffledOpts,
        ans: newAnsIndex,
        hint: q.hint
      };
    });

    state.coopState = {
      active: true,
      isMultiplayer: true,
      lobbyId: state.activeLobbyId,
      partnerId: partnerId,
      currentQIndex: 0,
      scoreUser: 0,
      scorePartner: 0,
      questions: coopQuestions
    };

    document.getElementById("comm-chat-active").classList.add("hidden");
    document.getElementById("comm-coop-active").classList.remove("hidden");
    document.getElementById("coop-partner-name").textContent = partnerName;
    document.getElementById("coop-partner-progress-label").textContent = `${partnerName}:`;

    updateCoopQuestion();
  }

  function updateCoopStateMultiplayer(players) {
    const cs = state.coopState;
    if (!cs || !cs.active) return;

    const myId = state.userProfile.id;
    const partnerId = Object.keys(players).find(id => id !== myId);

    const me = players[myId];
    const partner = players[partnerId];

    if (!me || !partner) return;

    cs.scoreUser = me.score;
    cs.scorePartner = partner.score;

    document.getElementById("coop-score-user").textContent = `${cs.scoreUser}/${me.currentIdx}`;
    document.getElementById("coop-score-partner").textContent = `${cs.scorePartner}/${partner.currentIdx}`;

    const userPercent = (me.currentIdx / cs.questions.length) * 100;
    const partnerPercent = (partner.currentIdx / cs.questions.length) * 100;
    document.getElementById("coop-progress-user").style.width = `${userPercent}%`;
    document.getElementById("coop-progress-partner").style.width = `${partnerPercent}%`;

    const hintAuthor = document.getElementById("coop-hint-author");
    const hintText = document.getElementById("coop-hint-text");

    if (me.currentIdx > partner.currentIdx) {
      if (hintAuthor) hintAuthor.textContent = partner.name;
      if (hintText) hintText.textContent = `Думает над вопросом #${partner.currentIdx + 1}...`;
    } else if (partner.currentIdx > me.currentIdx) {
      if (hintAuthor) hintAuthor.textContent = "Система:";
      if (hintText) hintText.textContent = `${partner.name} ответил! Теперь ваш ход.`;
      
      const optionButtons = document.querySelectorAll("#coop-options-container button");
      if (optionButtons.length > 0 && optionButtons[0].disabled && me.currentIdx === cs.currentQIndex) {
        optionButtons.forEach(btn => btn.disabled = false);
      }
    } else {
      if (me.currentIdx > cs.currentQIndex) {
        if (hintText) hintText.textContent = `Оба ответили! Загрузка следующего вопроса...`;
        setTimeout(() => {
          cs.currentQIndex = me.currentIdx;
          updateCoopQuestion();
        }, 1500);
      } else {
        if (hintAuthor) hintAuthor.textContent = partner.name;
        if (hintText) hintText.textContent = cs.questions[cs.currentQIndex].hint;
      }
    }
  }

  // --- MEDICAL FORUM SYSTEM ---
  const forumThreads = [
    { id: "thread_1", title: "Механизм действия сердечных гликозидов при ХСН", category: "pharmacology", author: "Кирилл_Фарма", authorAvatar: "💊", content: "Коллеги, давайте обсудим: почему дигоксин блокирует Na+/K+-АТФ-азу, и как это ведет к положительному инотропному эффекту? Хотелось бы детального биохимического разбора.", time: "1 час назад", replies: [
      { author: "Иван_Кардио", avatar: "🫀", content: "Все просто: ингибирование Na+/K+-АТФ-азы ведет к накоплению натрия внутри кардиомиоцита. Это замедляет работу Na+/Ca2+ обменника. Кальций дольше остается в саркоплазме, связывается с тропонином С, что усиливает сокращение миофибрилл! Но осторожно с гипокалиемией - она усиливает токсичность дигоксина.", time: "50 мин назад" }
    ] },
    { id: "thread_2", title: "Редкий клинический случай: Синдром Гийена-Барре после кампилобактериоза", category: "cases", author: "Мария_Нейро", authorAvatar: "🧠", content: "Пациент 34 лет поступил с восходящей мышечной слабостью в нижних конечностях и арефлексией. Две недели назад перенес гастроэнтерит Campylobacter jejuni. Каков оптимальный протокол лечения и патогенез молекулярной мимикрии?", time: "3 часа назад", replies: [
      { author: "Аня_Склиф", avatar: "🩺", content: "Обязателен плазмаферез или введение внутривенного иммуноглобулина (ВВИГ) в первые 2 недели! ГКС не показали эффективности. В основе лежит перекрестная реактивность антител против ганглиозидов миелина периферических нервов (GM1) с антигенами Campylobacter.", time: "2 часа назад" }
    ] }
  ];

  state.activeThreadId = null;

  function renderForumThreads(categoryFilter = "all") {
    const container = document.getElementById("forum-threads-container");
    if (!container) return;

    container.innerHTML = "";
    
    const filtered = categoryFilter === "all" ? forumThreads : forumThreads.filter(t => t.category === categoryFilter);

    if (filtered.length === 0) {
      container.innerHTML = "<div style='text-align:center; padding: 20px; color:var(--text-muted);'>Нет тем в этой категории. Создайте свою!</div>";
      return;
    }

    filtered.forEach(thread => {
      const card = document.createElement("div");
      card.className = "forum-thread-card";
      
      const catLabels = { pharmacology: "Фармакология 💊", cases: "Клинический случай 🩺", anatomy: "Анатомия 🧠" };
      const catColor = { pharmacology: "#fcd34d", cases: "var(--accent-pink)", anatomy: "var(--accent-cyan)" };

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <span class="forum-thread-category-badge" style="background: rgba(255,255,255,0.03); color: ${catColor[thread.category] || '#fff'}; border: 1px solid ${catColor[thread.category] || '#fff'}40;">
            ${catLabels[thread.category] || "Общее"}
          </span>
          <span style="font-size: 11px; color: var(--text-muted);">${thread.time}</span>
        </div>
        <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #fff;">${thread.title}</h4>
        <p style="margin: 0 0 10px 0; font-size: 12px; color: var(--text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${thread.content}
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
          <span style="color: var(--accent-cyan); display: flex; align-items: center; gap: 4px;">
            <span>${thread.authorAvatar}</span>
            <strong>${thread.author}</strong>
          </span>
          <span style="color: var(--text-muted);">${thread.replies.length} отв.</span>
        </div>
      `;

      card.onclick = () => {
        openForumThread(thread.id);
      };

      container.appendChild(card);
    });
  }

  function openForumThread(threadId) {
    state.activeThreadId = threadId;
    
    document.getElementById("forum-threads-list-pane").classList.add("hidden");
    document.getElementById("forum-single-thread-pane").classList.remove("hidden");
    document.getElementById("forum-new-thread-pane").classList.add("hidden");

    const thread = forumThreads.find(t => t.id === threadId);
    if (!thread) return;

    document.getElementById("forum-post-title").textContent = thread.title;
    document.getElementById("forum-post-content").textContent = thread.content;
    document.getElementById("forum-post-author").textContent = thread.author;
    document.getElementById("forum-post-avatar").textContent = thread.authorAvatar;
    document.getElementById("forum-post-time").textContent = thread.time;

    renderForumReplies();
  }

  function renderForumReplies() {
    const container = document.getElementById("forum-replies-container");
    if (!container) return;

    container.innerHTML = "";
    const thread = forumThreads.find(t => t.id === state.activeThreadId);
    if (!thread) return;

    thread.replies.forEach(rep => {
      const card = document.createElement("div");
      card.className = "forum-reply-card";
      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="font-size:16px;">${rep.avatar}</span>
          <strong style="font-size:12.5px; color:#fff;">${rep.author}</strong>
          <span style="font-size:10px; color:var(--text-muted); margin-left: auto;">${rep.time || 'только что'}</span>
        </div>
        <p style="margin: 0; font-size: 13px; color: var(--text-color); line-height: 1.5;">${rep.content}</p>
      `;
      container.appendChild(card);
      applyWikiLinks(card);
    });
  }

  function submitForumReply() {
    const input = document.getElementById("forum-reply-input");
    if (!input || input.value.trim() === "") return;

    const thread = forumThreads.find(t => t.id === state.activeThreadId);
    if (!thread) return;

    thread.replies.push({
      author: state.userProfile.username + " (Вы)",
      avatar: state.userProfile.avatar,
      content: input.value,
      time: "только что"
    });

    trackDailyAction("forum_replied");
    input.value = "";
    renderForumReplies();
    showToast("Ответ опубликован!");
  }

  function submitNewForumThread() {
    const title = document.getElementById("new-thread-title").value;
    const cat = document.getElementById("new-thread-category").value;
    const content = document.getElementById("new-thread-content").value;

    const newThread = {
      id: "thread_" + (forumThreads.length + 1),
      title: title,
      category: cat,
      author: state.userProfile.username,
      authorAvatar: state.userProfile.avatar,
      content: content,
      time: "только что",
      replies: []
    };

    forumThreads.unshift(newThread);
    trackDailyAction("forum_posted");
    
    const postCount = parseInt(safeStorage.getItem("medstudy_forum_posts_count") || "0") + 1;
    safeStorage.setItem("medstudy_forum_posts_count", postCount);
    
    unlockAchievement("forum_contributor");
    syncSocialStats();

    document.getElementById("forum-new-thread-pane").classList.add("hidden");
    document.getElementById("forum-threads-list-pane").classList.remove("hidden");
    
    renderForumThreads();
    showToast("Тема успешно создана!");

    simulateForumAutoReply(newThread.id, title, content);
  }

  function simulateForumAutoReply(threadId, qTitle, qContent) {
    const delay = 4000 + Math.random() * 3000;
    
    setTimeout(() => {
      const thread = forumThreads.find(t => t.id === threadId);
      if (!thread) return;

      const botPool = [
        { author: "Иван_Кардио", avatar: "🫀", text: "🫀 Отличный академический вопрос! Если оценивать патофизиологические аспекты, здесь ведущую роль играет гемодинамическая разгрузка миокарда и регуляция тонуса сосудов. На практике мы всегда следим за балансом электролитов (особенно K+ и Mg2+)." },
        { author: "Мария_Нейро", avatar: "🧠", text: "🧠 С неврологической точки зрения, крайне важно помнить про рефлекторную дугу и автономную регуляцию внутренних органов посредством блуждающего нерва и симпатического ствола." },
        { author: "Кирилл_Фарма", avatar: "💊", text: "💊 Как фармаколог, добавлю: обязательно проверяйте синергизм и антагонизм при одновременном назначении препаратов! Печеночный метаболизм CYP3A4 может сильно менять концентрацию лекарства." },
        { author: "Аня_Склиф", avatar: "🩺", text: "🩺 Как реаниматолог скажу: в острой фазе на первом месте - обеспечение проходимости дыхательных путей и стабилизация КОС (газы крови). Поддерживаю мнение коллег!" }
      ];

      const bot = botPool[Math.floor(Math.random() * botPool.length)];
      
      thread.replies.push({
        author: bot.author,
        avatar: bot.avatar,
        content: bot.text + `\n\nВ качестве рекомендации советую перечитать главу учебника или воспользоваться разделом калькуляторов в панели меню!`,
        time: "1 мин назад"
      });

      if (state.activeThreadId === threadId) {
        renderForumReplies();
      }
      
      renderForumThreads();
      showToast(`💬 Новый ответ на форуме от ${bot.author}!`);
    }, delay);
  }

  function simulateSystemMessage(text) {
    const activeFriendId = state.activeFriendId || "sklif_anya";
    const friend = friendsList.find(f => f.id === activeFriendId);
    if (!friend) return;
    
    friend.chatHistory.push({
      sender: "received",
      text: `⚙️ <strong>Системное сообщение:</strong> ${text}`,
      time: getFormattedTime()
    });
    
    if (state.activeFriendId === activeFriendId) {
      renderChatMessages();
    }
  }

  // --- FRIEND SEARCH & ADD SYSTEM ---
  const botUsersDatabase = [];
  let lastSearchResults = [];

  async function searchUsers(query) {
    if (!query || query.trim().length < 1) return [];
    const q = query.trim();
    
    try {
      const res = await fetch(`${API_URL}/users/search?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.users) {
        const existingIds = friendsList.map(f => f.id);
        const myProfile = safeStorage.getItem("medstudy_user_profile");
        let myId = "";
        if (myProfile) {
          try { myId = JSON.parse(myProfile).id; } catch(e) {}
        }
        
        lastSearchResults = data.users
          .filter(u => u.id !== myId && !existingIds.includes(u.id))
          .map(u => ({
            id: u.id,
            name: u.username,
            avatar: u.avatar || "👽",
            specialty: u.specialty || "Студент",
            status: u.rank || "Студент",
            online: true
          }));
        return lastSearchResults;
      }
    } catch (e) {
      console.warn("Error searching users:", e);
    }
    return [];
  }

  function addFriend(userId) {
    const user = lastSearchResults.find(u => u.id === userId);
    if (!user) return;
    if (friendsList.find(f => f.id === userId)) {
      showToast("Этот пользователь уже в ваших друзьях!", "warning");
      return;
    }
    
    friendsList.push({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      specialty: user.specialty,
      status: user.status,
      chatHistory: []
    });
    
    // Save to localStorage
    saveFriendsToStorage();
    
    renderFriendsList();
    showToast(`✅ ${user.name} добавлен(а) в друзья!`, "success");
    
    // Hide search results
    const searchResults = document.getElementById("friend-search-results");
    if (searchResults) { searchResults.style.display = "none"; searchResults.innerHTML = ""; }
    const searchInput = document.getElementById("friend-search-input");
    if (searchInput) searchInput.value = "";
  }

  function renderSearchResults(results) {
    const container = document.getElementById("friend-search-results");
    if (!container) return;
    
    if (results.length === 0) {
      container.style.display = "flex";
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px;">Никого не найдено</p>';
      return;
    }
    
    container.style.display = "flex";
    container.innerHTML = results.map(u => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(0,242,254,0.05);border:1px solid rgba(0,242,254,0.12);cursor:pointer;" onclick="addFriend('${u.id}')">
        <span style="font-size:20px;">${u.avatar}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;color:#fff;">${u.name}</div>
          <div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.specialty || ""}</div>
        </div>
        <button style="padding:4px 10px;border-radius:6px;background:linear-gradient(135deg,var(--accent-cyan),var(--accent-blue));border:none;color:#fff;font-size:11px;cursor:pointer;white-space:nowrap;" onclick="event.stopPropagation();addFriend('${u.id}')">➕ Добавить</button>
      </div>
    `).join("");
  }

  // Make addFriend globally accessible
  window.addFriend = addFriend;

  // Setup friend search event listeners
  function setupFriendSearch() {
    const searchBtn = document.getElementById("friend-search-btn");
    const searchInput = document.getElementById("friend-search-input");
    
    if (searchBtn && searchInput) {
      searchBtn.onclick = async () => {
        const results = await searchUsers(searchInput.value);
        renderSearchResults(results);
      };
      searchInput.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          const results = await searchUsers(searchInput.value);
          renderSearchResults(results);
        }
      });
      let debounceTimeout;
      searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(async () => {
          if (searchInput.value.length >= 1) {
            const results = await searchUsers(searchInput.value);
            renderSearchResults(results);
          } else {
            const container = document.getElementById("friend-search-results");
            if (container) { container.style.display = "none"; container.innerHTML = ""; }
          }
        }, 300);
      });
    }
  }

  // Load saved friends from localStorage
  function loadSavedFriends() {
    const saved = safeStorage.getItem("medstudy_friends_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.forEach(sf => {
          if (!friendsList.find(f => f.id === sf.id)) {
            const botUser = botUsersDatabase.find(b => b.id === sf.id);
            friendsList.push({
              id: sf.id,
              name: sf.name,
              avatar: sf.avatar,
              specialty: sf.specialty,
              status: sf.status || (botUser ? botUser.status : "В сети"),
              chatHistory: sf.chatHistory || []
            });
          }
        });
      } catch(e) {}
    }
  }

  function saveFriendsToStorage() {
    const savedFriends = friendsList.map(f => ({
      id: f.id,
      name: f.name,
      avatar: f.avatar,
      specialty: f.specialty,
      status: f.status,
      chatHistory: f.chatHistory || []
    }));
    safeStorage.setItem("medstudy_friends_list", JSON.stringify(savedFriends));
  }

  // --- DAILY QUESTS SYSTEM ---
  const DAILY_QUEST_TEMPLATES = [
    { id: "study_cards", title: "📚 Изучить 5 карточек", desc: "Пройди 5 флеш-карточек", target: 5, xp: 50, trackKey: "med_cards_count" },
    { id: "pass_quiz", title: "📝 Пройти 1 тест", desc: "Заверши любой тест", target: 1, xp: 75, trackKey: "med_quizzes_today" },
    { id: "solve_case", title: "🏥 Решить клин. кейс", desc: "Реши 1 клинический случай", target: 1, xp: 100, trackKey: "med_cases_today" },
    { id: "win_duel", title: "⚔️ Выиграть дуэль", desc: "Победи друга в карточной дуэли", target: 1, xp: 80, trackKey: "med_duels_today" },
    { id: "read_chapter", title: "📖 Прочитать главу", desc: "Открой и прочитай главу учебника", target: 1, xp: 60, trackKey: "med_chapters_today" },
    { id: "forum_post", title: "💬 Написать на форум", desc: "Создай тему или ответь на форуме", target: 1, xp: 50, trackKey: "med_forum_today" }
  ];

  function generateDailyQuests() {
    const today = new Date().toDateString();
    const stored = safeStorage.getItem("medstudy_daily_quests");
    
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.date === today) {
          return data.quests;
        }
      } catch(e) {}
    }
    
    // Generate 3 random quests for today
    const shuffled = [...DAILY_QUEST_TEMPLATES].sort(() => Math.random() - 0.5);
    const quests = shuffled.slice(0, 3).map(t => ({
      ...t,
      progress: 0,
      completed: false
    }));
    
    safeStorage.setItem("medstudy_daily_quests", JSON.stringify({ date: today, quests, bonusClaimed: false }));
    return quests;
  }

  function renderDailyQuests() {
    const container = document.getElementById("daily-quests-container");
    const timerEl = document.getElementById("daily-quests-timer");
    const bonusEl = document.getElementById("daily-quests-bonus");
    if (!container) return;
    
    const quests = generateDailyQuests();
    
    // Calculate time until midnight reset
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diffMs = midnight - now;
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    if (timerEl) timerEl.textContent = `Сброс через: ${hours}ч ${mins}м`;
    
    container.innerHTML = quests.map(q => {
      const pct = Math.min(100, (q.progress / q.target) * 100);
      const isDone = q.completed;
      return `
        <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,${isDone ? '0.15' : '0.05'});${isDone ? 'opacity:0.6;' : ''}">
          <div style="font-size:22px;">${isDone ? '✅' : q.title.split(' ')[0]}</div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;color:${isDone ? '#00ff88' : '#fff'};margin-bottom:4px;">${q.title.split(' ').slice(1).join(' ')}</div>
            <div style="width:100%;height:6px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;">
              <div style="width:${pct}%;height:100%;border-radius:3px;background:${isDone ? '#00ff88' : 'linear-gradient(90deg,var(--accent-cyan),var(--accent-blue))'};transition:width 0.5s;"></div>
            </div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">${q.progress}/${q.target} · +${q.xp} XP</div>
          </div>
        </div>
      `;
    }).join("");
    
    // Check if all quests are completed
    const allDone = quests.every(q => q.completed);
    if (bonusEl) {
      bonusEl.style.display = allDone ? "block" : "none";
    }
  }

  function completeDailyQuest(questId) {
    const stored = safeStorage.getItem("medstudy_daily_quests");
    if (!stored) return;
    
    try {
      const data = JSON.parse(stored);
      const quest = data.quests.find(q => q.id === questId);
      if (!quest || quest.completed) return;
      
      quest.progress = Math.min(quest.target, quest.progress + 1);
      
      if (quest.progress >= quest.target && !quest.completed) {
        quest.completed = true;
        addXP(quest.xp);
        showToast(`🎯 Задание выполнено: ${quest.title}! +${quest.xp} XP`, "success");
        
        // Check bonus
        if (data.quests.every(q => q.completed) && !data.bonusClaimed) {
          data.bonusClaimed = true;
          addXP(200);
          showToast("🏆 Идеальный день! Все задания выполнены! +200 XP бонус!", "success", 5000);
        }
      }
      
      safeStorage.setItem("medstudy_daily_quests", JSON.stringify(data));
      renderDailyQuests();
    } catch(e) {}
  }

  // Hook daily quest tracking into existing functions
  const _originalAddXP = addXP;
  // Track quest completions by intercepting key actions
  function trackDailyAction(actionType) {
    const questMap = {
      "card_studied": "study_cards",
      "quiz_passed": "pass_quiz",
      "case_solved": "solve_case",
      "duel_won": "win_duel",
      "chapter_read": "read_chapter",
      "forum_posted": "forum_post"
    };
    const questId = questMap[actionType];
    if (questId) completeDailyQuest(questId);
  }

  function showInviteModal(senderName, type, onAccept, onDecline) {
    const existing = document.getElementById("multiplayer-invite-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "multiplayer-invite-modal";
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(5, 8, 16, 0.75);
      backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.3s ease;
    `;

    const typeText = type === "duel" ? "Дуэль на флеш-карточках ⚔️" : "Совместный тест 📝";

    modal.innerHTML = `
      <div class="glass-panel" style="
        width: 380px; padding: 25px; border-radius: 16px;
        background: rgba(13, 20, 38, 0.95);
        border: 1px solid rgba(0, 242, 254, 0.3);
        box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        text-align: center;
        transform: scale(0.9); transition: transform 0.3s ease;
      ">
        <span style="font-size: 40px; display: block; margin-bottom: 15px;">🎮</span>
        <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold; color: #fff;">Вызов на игру!</h3>
        <p style="margin: 0 0 20px 0; font-size: 13.5px; color: var(--text-muted); line-height: 1.5;">
          Игрок <strong style="color: var(--accent-cyan);">${senderName}</strong> приглашает вас сыграть в:<br>
          <strong style="color: var(--accent-pink);">${typeText}</strong>
        </p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="invite-btn-decline" class="btn btn-outline" style="flex: 1; border-color: rgba(255,255,255,0.15); color: #fff;">Отклонить</button>
          <button id="invite-btn-accept" class="btn btn-primary" style="flex: 1; font-weight: bold;">Принять</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      modal.style.opacity = "1";
      modal.querySelector("div").style.transform = "scale(1)";
    });

    const close = () => {
      modal.style.opacity = "0";
      modal.querySelector("div").style.transform = "scale(0.9)";
      setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector("#invite-btn-accept").onclick = () => {
      close();
      onAccept();
    };

    modal.querySelector("#invite-btn-decline").onclick = () => {
      close();
      onDecline();
    };
  }

  // Run the initialization
  init();
});
