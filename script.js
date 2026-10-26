 // ---------- 1. Connect to the database (Supabase) ----------
 const SUPABASE_URL = "https://bxjfiaqnehmesbdtcfrh.supabase.co";
 const SUPABASE_KEY = "sb_publishable_k3SAuO-v7k4upNve8AlomQ_kjC4Mv4Z";
 
 const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
 
 // ---------- 2. Grab the elements we need ----------
 const authScreen = document.getElementById("auth-screen");
 const chatScreen = document.getElementById("chat-screen");
 const authForm = document.getElementById("auth-form");
 const authMessage = document.getElementById("auth-message");
 const displayName = document.getElementById("display-name");
 const emailInput = document.getElementById("email");
 const passwordInput = document.getElementById("password");
 const signupBtn = document.getElementById("signup-btn");
 const logoutBtn = document.getElementById("logout-btn");
 const who = document.getElementById("who");
 const messageList = document.getElementById("messages");
 const messageForm = document.getElementById("message-form");
 const messageInput = document.getElementById("message-input");
 
 // ---------- 3. Weather API URLs ----------
 const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
 const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
 
 // ---------- 4. What the app remembers while it runs ----------
 let currentUser = null;
 const names = {};
 let channel = null;
 
 // ---------- 5. Sign up, log in, log out ----------
 async function signUp() {
   const name = displayName.value.trim();
 
   if (name.length < 2 || name.length > 24) {
     authMessage.textContent =
       "Enter a display name (2 to 24 characters).";
     return;
   }
 
   authMessage.textContent = "Creating your account...";
 
   const { data, error } = await sb.auth.signUp({
     email: emailInput.value.trim(),
     password: passwordInput.value,
     options: { data: { display_name: name } },
   });
 
   if (error) {
     authMessage.textContent = error.message;
   } else if (!data.session) {
     authMessage.textContent =
       "Check your email to confirm your account.";
   } else {
     authMessage.textContent = "";
   }
 }
 
 async function logIn() {
   authMessage.textContent = "Logging in...";
 
   const { error } = await sb.auth.signInWithPassword({
     email: emailInput.value.trim(),
     password: passwordInput.value,
   });
 
   authMessage.textContent = error ? error.message : "";
 }
 
 authForm.addEventListener("submit", (event) => {
   event.preventDefault();
   logIn();
 });
 
 signupBtn.addEventListener("click", () => {
   if (authForm.reportValidity()) signUp();
 });
 
 logoutBtn.addEventListener("click", () => sb.auth.signOut());
 
 // ---------- 6. React when the login state changes ----------
 sb.auth.onAuthStateChange((event, session) => {
   const user = session ? session.user : null;
 
   setTimeout(() => {
     if (user && (!currentUser || currentUser.id !== user.id)) {
       startChat(user);
     }
 
     if (!user && currentUser) {
       stopChat();
     }
   }, 0);
 });
 
 // ---------- 7. Start and stop the chat room ----------
 async function startChat(user) {
   currentUser = user;
   authScreen.hidden = true;
   chatScreen.hidden = false;
   who.textContent = "Loading...";
 
   await loadNames();
 
   who.textContent = names[user.id] || "Signed in";
 
   await loadMessages();
   listenForNewMessages();
   messageInput.focus();
 }
 
 function stopChat() {
   currentUser = null;
 
   if (channel) sb.removeChannel(channel);
 
   channel = null;
   messageList.innerHTML = "";
   passwordInput.value = "";
   chatScreen.hidden = true;
   authScreen.hidden = false;
 }
 
 // ---------- 8. Show one message on the screen ----------
 function showMessage(msg) {
   if (messageList.querySelector('[data-id="' + msg.id + '"]')) {
     return;
   }
 
   if (!currentUser) return;
 
   const isMine = msg.user_id === currentUser.id;
   const item = document.createElement("li");
 
   item.className = isMine ? "message mine" : "message";
   item.dataset.id = msg.id;
 
   const author = document.createElement("span");
   author.className = "author";
   author.textContent = names[msg.user_id] || "Unknown";
 
   const text = document.createElement("p");
   text.textContent = msg.content;
 
   const time = document.createElement("time");
   time.textContent = new Date(msg.created_at).toLocaleTimeString([], {
     hour: "numeric",
     minute: "2-digit",
   });
 
   item.append(author, text, time);
   messageList.appendChild(item);
   messageList.scrollTop = messageList.scrollHeight;
 }
 
 // ---------- 9. Show a WeatherBot message inside the chat ----------
 function showBotMessage(content) {
   const item = document.createElement("li");
   item.className = "message";
 
   const author = document.createElement("span");
   author.className = "author";
   author.textContent = "WeatherBot";
 
   const text = document.createElement("p");
   text.textContent = content;
 
   const time = document.createElement("time");
   time.textContent = new Date().toLocaleTimeString([], {
     hour: "numeric",
     minute: "2-digit",
   });
 
   item.append(author, text, time);
   messageList.appendChild(item);
   messageList.scrollTop = messageList.scrollHeight;
 }
 
 // ---------- 10. Send messages and handle commands ----------
 messageForm.addEventListener("submit", async (event) => {
   event.preventDefault();
 
   const content = messageInput.value.trim();
   if (content === "") return;
 
   messageInput.value = "";
 
   // Handle /weather without saving the command as a normal message.
   if (handleCommand(content)) return;
 
   // Save normal messages to Supabase.
   const { data, error } = await sb
     .from("messages")
     .insert({ content: content })
     .select()
     .single();
 
   if (error) {
     alert("Could not send: " + error.message);
     messageInput.value = content;
     return;
   }
 
   showMessage(data);
 });
 
 // ---------- 11. Read data from the database ----------
 async function loadNames() {
   const { data, error } = await sb
     .from("profiles")
     .select("id, display_name");
 
   if (error) {
     console.error(error);
     return;
   }
 
   data.forEach((profile) => {
     names[profile.id] = profile.display_name;
   });
 }
 
 async function loadMessages() {
   const { data, error } = await sb
     .from("messages")
     .select("id, user_id, content, created_at")
     .order("created_at", { ascending: false })
     .limit(50);
 
   if (error) {
     console.error(error);
     return;
   }
 
   messageList.innerHTML = "";
   data.reverse().forEach(showMessage);
 }
 
 // ---------- 12. Get new messages instantly (Realtime) ----------
 async function nameFor(userId) {
   if (!names[userId]) {
     const { data } = await sb
       .from("profiles")
       .select("display_name")
       .eq("id", userId)
       .single();
 
     names[userId] = data ? data.display_name : "Unknown";
   }
 
   return names[userId];
 }
 
 function listenForNewMessages() {
   if (channel) sb.removeChannel(channel);
 
   channel = sb
     .channel("class-chat")
     .on(
       "postgres_changes",
       { event: "INSERT", schema: "public", table: "messages" },
       async (payload) => {
         await nameFor(payload.new.user_id);
         showMessage(payload.new);
       }
     )
     .on(
       "postgres_changes",
       { event: "DELETE", schema: "public", table: "messages" },
       (payload) => removeMessage(payload.old.id)
     )
     .subscribe();
 }
 
 function removeMessage(id) {
   const item = messageList.querySelector('[data-id="' + id + '"]');
   if (item) item.remove();
 }
 
 // ---------- 13. Handle the /weather command ----------
 function handleCommand(text) {
   if (!text.toLowerCase().startsWith("/weather")) {
     return false;
   }
 
   // Accept "/weather Manila" and "/weatherManila" is not required.
   const city = text.slice(8).trim();
 
   if (!city) {
     showBotMessage("Usage: /weather Manila");
     return true;
   }
 
   getWeather(city);
   return true;
 }
 
 // ---------- 14. Get weather from Open-Meteo ----------
 async function getWeather(city) {
   try {
     showBotMessage(`Looking up the weather for ${city}...`);
 
     const geoResponse = await fetch(
       `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
     );
 
     if (!geoResponse.ok) {
       throw new Error("The city lookup service returned an error.");
     }
 
     const geoData = await geoResponse.json();
 
     if (!geoData.results || geoData.results.length === 0) {
       showBotMessage(`Sorry, I couldn't find the city "${city}".`);
       return;
     }
 
     const place = geoData.results[0];
 
     const weatherResponse = await fetch(
       `${WEATHER_URL}?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`
     );
 
     if (!weatherResponse.ok) {
       throw new Error("The weather service returned an error.");
     }
 
     const weatherData = await weatherResponse.json();
     const current = weatherData.current;
 
     if (!current) {
       throw new Error("Weather data was unavailable.");
     }
 
     const weatherMessage =
       `🌤️ Weather in ${place.name}\n` +
       `Temperature: ${current.temperature_2m}°C\n` +
       `Feels like: ${current.apparent_temperature}°C\n` +
       `Humidity: ${current.relative_humidity_2m}%\n` +
       `Wind: ${current.wind_speed_10m} km/h`;
 
     showBotMessage(weatherMessage);
   } catch (error) {
     console.error("Weather error:", error);
 
     showBotMessage(
       "Sorry, I couldn't retrieve the weather. Please check your internet connection and try again."
     );
   }
 }
