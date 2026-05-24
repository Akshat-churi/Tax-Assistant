const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");
const voiceRecordBtn = document.querySelector("#voice-record-btn");
const voiceSettingsBtn = document.querySelector("#voice-settings-btn");
const voiceStatusText = document.querySelector("#voice-status-text");
const voiceIndicator = document.querySelector("#voice-indicator");
const recentChatsList = document.querySelector("#recent-chats-list");
const newChatBtn = document.querySelector("#new-chat-btn");
const sidebar = document.querySelector("#sidebar");
const sidebarToggleBtn = document.querySelector("#sidebar-toggle-btn");

// API Setup
const API_URL = "/api/chat";

// Voice and Speech Setup
let recognition = null;
let synthesis = window.speechSynthesis;
let voices = [];
let controller, typingInterval;
let isRecording = false;
let isSpeaking = false;

// Application State
let currentChatId = Date.now();
let chatHistory = [];
let allChats = JSON.parse(localStorage.getItem("allChats") || "[]");
const userData = { message: "", file: {} };
const voiceSettings = {
  rate: 1,
  pitch: 1,
  volume: 1,
  autoSpeak: true,
  voice: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  initializeVoice();
  loadVoices();
  setupEventListeners();
  setInitialTheme();
  setInitialSidebarState();
  renderRecentChats();
  
  // Start with a clean slate (Welcome Screen)
  startNewChat();
});

// Start a fresh chat
function startNewChat() {
  currentChatId = Date.now();
  chatHistory = [];
  chatsContainer.innerHTML = "";
  document.body.classList.remove("chats-active", "bot-responding");
  promptInput.value = "";
  stopSpeech();
}

// Initialize voice recognition
function initializeVoice() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      isRecording = true;
      voiceRecordBtn.classList.add('recording');
      voiceStatusText.textContent = 'Listening...';
      voiceIndicator.classList.add('recording');
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      promptInput.value = transcript;
      voiceStatusText.textContent = 'Voice ready';
    };
    
    recognition.onend = () => {
      isRecording = false;
      voiceRecordBtn.classList.remove('recording');
      voiceStatusText.textContent = 'Voice ready';
      voiceIndicator.classList.remove('recording');
    };
    
    recognition.onerror = () => {
      isRecording = false;
      voiceRecordBtn.classList.remove('recording');
      voiceStatusText.textContent = 'Voice error';
      voiceIndicator.classList.remove('recording');
    };
  }
}

// Load available voices
function loadVoices() {
  voices = synthesis.getVoices();
  const voiceSelect = document.querySelector("#voice-select");
  if (voiceSelect) {
    voiceSelect.innerHTML = '<option value="">Default</option>';
    voices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
    });
  }
  
  const savedSettings = localStorage.getItem('voiceSettings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    Object.assign(voiceSettings, settings);
    if (voiceSelect) voiceSelect.value = settings.voice || '';
    document.querySelector("#voice-rate").value = settings.rate || 1;
    document.querySelector("#voice-pitch").value = settings.pitch || 1;
    document.querySelector("#voice-volume").value = settings.volume || 1;
    document.querySelector("#auto-speak").checked = settings.autoSpeak !== false;
    updateVoiceValueDisplays();
  }
}

function updateVoiceValueDisplays() {
  document.querySelector("#rate-value").textContent = voiceSettings.rate.toFixed(1);
  document.querySelector("#pitch-value").textContent = voiceSettings.pitch.toFixed(1);
  document.querySelector("#volume-value").textContent = voiceSettings.volume.toFixed(1);
}

function setupEventListeners() {
  voiceRecordBtn.addEventListener("click", toggleVoiceRecording);
  voiceSettingsBtn.addEventListener("click", () => document.querySelector("#voice-settings-modal").style.display = "flex");
  document.querySelector("#close-voice-settings").addEventListener("click", () => document.querySelector("#voice-settings-modal").style.display = "none");
  
  document.querySelector("#voice-select").addEventListener("change", (e) => { voiceSettings.voice = e.target.value; saveVoiceSettings(); });
  document.querySelector("#voice-rate").addEventListener("input", (e) => { voiceSettings.rate = parseFloat(e.target.value); updateVoiceValueDisplays(); saveVoiceSettings(); });
  document.querySelector("#voice-pitch").addEventListener("input", (e) => { voiceSettings.pitch = parseFloat(e.target.value); updateVoiceValueDisplays(); saveVoiceSettings(); });
  document.querySelector("#voice-volume").addEventListener("input", (e) => { voiceSettings.volume = parseFloat(e.target.value); updateVoiceValueDisplays(); saveVoiceSettings(); });
  document.querySelector("#auto-speak").addEventListener("change", (e) => { voiceSettings.autoSpeak = e.target.checked; saveVoiceSettings(); });

  promptForm.addEventListener("submit", handleFormSubmit);
  fileInput.addEventListener("change", handleFileInput);
  document.querySelector("#cancel-file-btn").addEventListener("click", cancelFileUpload);
  document.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());
  document.querySelector("#stop-response-btn").addEventListener("click", stopBotResponse);
  themeToggleBtn.addEventListener("click", toggleTheme);
  document.querySelector("#delete-chats-btn").addEventListener("click", deleteAllChats);
  newChatBtn.addEventListener("click", startNewChat);
  sidebarToggleBtn.addEventListener("click", toggleSidebar);

  document.querySelectorAll(".suggestions-item").forEach((suggestion) => {
    suggestion.addEventListener("click", () => {
      promptInput.value = suggestion.querySelector(".text").textContent;
      promptForm.dispatchEvent(new Event("submit"));
    });
  });
}

function toggleVoiceRecording() {
  if (!recognition) return;
  isRecording ? recognition.stop() : recognition.start();
}

function saveVoiceSettings() {
  localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
}

// Storage Optimization: Filter out large base64 data before saving
const saveChatHistory = () => {
  // Find current chat index
  const chatIdx = allChats.findIndex(c => c.id === currentChatId);
  
  // Filter messages to remove image data for storage efficiency
  const optimizedMessages = chatHistory.map(msg => ({
    role: msg.role,
    parts: msg.parts.map(part => {
      if (part.inline_data) return { text: "[Image attached]" }; // Don't save large base64
      return part;
    })
  }));

  const chatData = {
    id: currentChatId,
    title: chatHistory[0]?.parts[0].text.substring(0, 30) + "..." || "New Chat",
    messages: optimizedMessages
  };

  if (chatIdx > -1) {
    allChats[chatIdx] = chatData;
  } else {
    allChats.unshift(chatData);
  }

  // Keep only last 20 chats to avoid quota issues
  if (allChats.length > 20) allChats.pop();

  localStorage.setItem("allChats", JSON.stringify(allChats));
  renderRecentChats();
};

const renderRecentChats = () => {
  recentChatsList.innerHTML = "";
  allChats.forEach(chat => {
    const li = document.createElement("li");
    li.classList.add("chat-item");
    li.textContent = chat.title;
    li.onclick = () => loadChat(chat.id);
    recentChatsList.appendChild(li);
  });
};

const loadChat = (id) => {
  const chat = allChats.find(c => c.id === id);
  if (!chat) return;

  currentChatId = chat.id;
  chatHistory = JSON.parse(JSON.stringify(chat.messages)); // Deep copy
  chatsContainer.innerHTML = "";
  document.body.classList.add("chats-active");

  chatHistory.forEach(msg => {
    const div = createMessageElement(
      `<img class="avatar" src="${msg.role === 'user' ? 'assets/user.png' : 'assets/bot.png'}" /> <p class="message-text"></p>`,
      msg.role === 'user' ? "user-message" : "bot-message"
    );
    div.querySelector(".message-text").textContent = msg.parts[0].text;
    chatsContainer.appendChild(div);
  });
  scrollToBottom();
};

// Set initial theme
function setInitialTheme() {
  const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
  document.body.classList.toggle("light-theme", isLightTheme);
  themeToggleBtn.innerHTML = `<span class="material-symbols-rounded">${isLightTheme ? "dark_mode" : "light_mode"}</span> Theme`;
}

function toggleTheme() {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  themeToggleBtn.innerHTML = `<span class="material-symbols-rounded">${isLightTheme ? "dark_mode" : "light_mode"}</span> Theme`;
}

// Sidebar logic
function setInitialSidebarState() {
  const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
  sidebar.classList.toggle("collapsed", isCollapsed);
}

function toggleSidebar() {
  const isCollapsed = sidebar.classList.toggle("collapsed");
  localStorage.setItem("sidebarCollapsed", isCollapsed);
}

function speakText(text) {
  if (!voiceSettings.autoSpeak || isSpeaking) return;
  synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = voiceSettings.rate;
  utterance.pitch = voiceSettings.pitch;
  utterance.volume = voiceSettings.volume;
  if (voiceSettings.voice && voices[voiceSettings.voice]) utterance.voice = voices[voiceSettings.voice];
  utterance.onstart = () => { isSpeaking = true; voiceIndicator.classList.add('speaking'); };
  utterance.onend = () => { isSpeaking = false; voiceIndicator.classList.remove('speaking'); };
  synthesis.speak(utterance);
}

function stopSpeech() {
  synthesis.cancel();
  isSpeaking = false;
  voiceIndicator.classList.remove('speaking');
}

const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

const scrollToBottom = () => {
  container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
};

const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = text.split(" ");
  let wordIndex = 0;
  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
      chatHistory.push({ role: "model", parts: [{ text: text }] });
      saveChatHistory();
      if (voiceSettings.autoSpeak) speakText(text);
    }
  }, 40);
};

const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();
  
  // User message is already in chatHistory from handleFormSubmit
  saveChatHistory();
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: chatHistory }),
      signal: controller.signal,
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "API Error");
    
    const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
    typingEffect(responseText, textElement, botMsgDiv);
  } catch (error) {
    textElement.textContent = error.name === "AbortError" ? "Stopped." : error.message;
    textElement.style.color = "var(--danger-color)";
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
  } finally {
    userData.file = {};
  }
};

const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;
  
  userData.message = userMessage;
  promptInput.value = "";
  document.body.classList.add("chats-active", "bot-responding");
  
  // Add to history
  chatHistory.push({
    role: "user",
    parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])],
  });

  const userMsgHTML = `<img class="avatar" src="assets/user.png" /> <p class="message-text"></p>
    ${userData.file.data ? (userData.file.isImage ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />` : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}`;
  
  const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userData.message;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();
  
  setTimeout(() => {
    const botMsgHTML = `<img class="avatar" src="assets/bot.png" /> <p class="message-text">Thinking...</p>`;
    const botMsgDiv = createMessageElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 600);
};

const handleFileInput = () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    const base64String = e.target.result.split(",")[1];
    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add("active", file.type.startsWith("image/") ? "img-attached" : "file-attached");
    userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage: file.type.startsWith("image/") };
  };
};

const cancelFileUpload = () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
};

const stopBotResponse = () => {
  controller?.abort();
  clearInterval(typingInterval);
  stopSpeech();
  const loadingMessage = chatsContainer.querySelector(".bot-message.loading");
  if (loadingMessage) {
    loadingMessage.classList.remove("loading");
    loadingMessage.querySelector(".message-text").textContent = "Stopped.";
  }
  document.body.classList.remove("bot-responding");
};

const deleteAllChats = () => {
  if (confirm("Clear all history?")) {
    allChats = [];
    localStorage.removeItem("allChats");
    startNewChat();
    renderRecentChats();
  }
};

window.addEventListener("click", (e) => {
  if (e.target === document.querySelector("#voice-settings-modal")) {
    document.querySelector("#voice-settings-modal").style.display = "none";
  }
});

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}
