/**************************************/
/*         firebase-config.js         */
/**************************************/
const firebaseConfig = {
  apiKey: "AIzaSyDuFjeruJPdkDLUOazyA_BzpTKA1SWT4bw",
  authDomain: "inventory-d35b5.firebaseapp.com",
  databaseURL: "https://inventory-d35b5-default-rtdb.firebaseio.com",
  projectId: "inventory-d35b5",
  storageBucket: "inventory-d35b5.firebasestorage.app",
  messagingSenderId: "512369551549",
  appId: "1:512369551549:web:0a8ba6d030fdad8c392fd4",
  measurementId: "G-0NYHYLDQED"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

/**************************************/
/*            helpers.js              */
/**************************************/
// Hashing Function using SHA-256
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Popup Message
function showPopup(message) {
  const popup = document.getElementById('popup-message');
  popup.textContent = message;
  if (message.toLowerCase().includes("incorrect")) {
    popup.classList.add("error-popup");
  } else {
    popup.classList.remove("error-popup");
  }
  popup.style.display = 'block';
  setTimeout(() => {
    popup.style.display = 'none';
  }, 3000);
}

// Custom Confirm Dialog
function customConfirm(message) {
  return new Promise((resolve, reject) => {
    const confirmOverlay = document.getElementById('custom-confirm');
    const messageElem = document.getElementById('custom-confirm-message');
    const yesButton = document.getElementById('custom-confirm-yes');
    const noButton = document.getElementById('custom-confirm-no');
    messageElem.textContent = message;
    confirmOverlay.style.display = 'flex';
    yesButton.onclick = () => { confirmOverlay.style.display = 'none'; resolve(true); };
    noButton.onclick = () => { confirmOverlay.style.display = 'none'; resolve(false); };
  });
}

// Global Home Function
function goHome() {
  localStorage.removeItem("userRole");
  localStorage.removeItem("selectedStore");
  location.reload();
}

/**************************************/
/*             auth.js                */
/**************************************/
// Global Variables & Default Passwords
let currentRole = "";  // "lead", "manager" or "admin"
let selectedStore = "";
let pendingStore = ""; // For lead mode pending store password entry

const DEFAULT_MANAGER_PASSWORD = "Access";
const DEFAULT_STORE_PASSWORDS = {
  HeadHouse: "0101",
  Mobile: "0000",
  D: "1010",
  Baggage: "1111",
  Departures: "1110",
  Connector: "0001"
};
const DEFAULT_ADMIN_PASSWORD = "DUWADI";

// Global variables for hashed passwords
let managerPassword = "";
let storePasswords = {};
let ADMIN_PASSWORD_HASH = "";

// Load Passwords from Firebase & Initialize Defaults if Needed
async function loadPasswords() {
  try {
    const snapshot = await database.ref('passwords').once('value');
    if (snapshot.exists()) {
      const data = snapshot.val();
      managerPassword = data.manager; // Already hashed
      storePasswords = data.store;
    } else {
      managerPassword = await hashPassword(DEFAULT_MANAGER_PASSWORD);
      storePasswords = {};
      for (const store in DEFAULT_STORE_PASSWORDS) {
        storePasswords[store] = await hashPassword(DEFAULT_STORE_PASSWORDS[store]);
      }
      database.ref('passwords').set({
        manager: managerPassword,
        store: storePasswords
      });
    }
  } catch (error) {
    console.error(error);
  }
}

// Pre-calculate the admin password hash.
hashPassword(DEFAULT_ADMIN_PASSWORD).then(hash => { ADMIN_PASSWORD_HASH = hash; });

// Attach home event listeners
document.getElementById('manager-home-btn').addEventListener('click', goHome);
document.getElementById('store-home-btn').addEventListener('click', goHome);
document.getElementById('store-selection-home-btn').addEventListener('click', goHome);
document.getElementById('admin-password-home-btn').addEventListener('click', goHome);
document.getElementById('admin-home-btn').addEventListener('click', goHome);
document.getElementById('global-home-btn').addEventListener('click', goHome);

// Role Selection
document.querySelectorAll('#role-selection button').forEach(btn => {
  btn.addEventListener('click', function() {
    currentRole = this.getAttribute('data-role');
    document.getElementById('role-selection').style.display = 'none';
    if (currentRole === "manager") {
      document.getElementById('manager-password-screen').style.display = 'flex';
    } else if (currentRole === "lead") {
      document.getElementById('store-selection').style.display = 'flex';
    } else if (currentRole === "admin") {
      document.getElementById('admin-password-screen').style.display = 'flex';
    }
  });
});

// Manager Password Check
document.getElementById('manager-password-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const pwd = document.getElementById('manager-password-input').value;
  const hashedInput = await hashPassword(pwd);
  if (hashedInput === managerPassword) {
    localStorage.setItem("userRole", currentRole);
    document.getElementById('manager-password-screen').style.display = 'none';
    document.getElementById('store-selection').style.display = 'flex';
  } else {
    showPopup('Incorrect Manager Password.');
    document.getElementById('manager-password-input').value = '';
  }
});

// Admin Password Check
document.getElementById('admin-password-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const pwd = document.getElementById('admin-password-input').value;
  const hashedInput = await hashPassword(pwd);
  if (hashedInput === ADMIN_PASSWORD_HASH) {
    localStorage.setItem("userRole", currentRole);
    document.getElementById('admin-password-screen').style.display = 'none';
    renderAdminUI();
  } else {
    showPopup('Incorrect Admin Password.');
    document.getElementById('admin-password-input').value = '';
  }
});

// Store Password Check for Lead
document.getElementById('store-password-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const pwd = document.getElementById('store-password-input').value;
  const hashedInput = await hashPassword(pwd);
  if (hashedInput === storePasswords[pendingStore]) {
    selectedStore = pendingStore;
    localStorage.setItem("userRole", currentRole);
    localStorage.setItem("selectedStore", pendingStore);
    document.getElementById('store-password-screen').style.display = 'none';
    updateHeadingAndLoadData(pendingStore);
  } else {
    showPopup('Incorrect store password.');
    document.getElementById('store-password-input').value = '';
  }
});

// Switch Back buttons on Password Screens
document.getElementById('manager-back-btn').addEventListener('click', function() {
  document.getElementById('manager-password-screen').style.display = 'none';
  document.getElementById('role-selection').style.display = 'flex';
});
document.getElementById('admin-back-btn').addEventListener('click', function() {
  document.getElementById('admin-password-screen').style.display = 'none';
  document.getElementById('role-selection').style.display = 'flex';
});
document.getElementById('store-back-btn').addEventListener('click', function() {
  document.getElementById('store-password-screen').style.display = 'none';
  document.getElementById('store-selection').style.display = 'flex';
});

// Store Selection (Manager & Lead)
document.querySelectorAll('#store-selection .store-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const store = this.getAttribute('data-store');
    if (currentRole === "manager") {
      selectedStore = store;
      localStorage.setItem("selectedStore", store);
      document.getElementById('store-selection').style.display = 'none';
      updateHeadingAndLoadData(store);
    } else {
      pendingStore = store;
      document.getElementById('store-selection').style.display = 'none';
      document.getElementById('store-password-input').placeholder = `Password for ${store}`;
      document.getElementById('store-password-screen').style.display = 'flex';
    }
  });
});

/**************************************/
/*           inventory.js             */
/**************************************/
const inventoryCategories = {
  milks: [
    "2%", "Whole Milk", "Nonfat", "Half n Half", "Heavy Cream",
    "Oatmilk", "Almond Milk", "Coconut Milk", "Soymilk", "Nondairy Vanilla Creamer"
  ],
  syrups: [
    "Vanilla", "SF Vanilla", "Caramel", "Classic", "Brown Sugar", "Cinamon Dolce",
    "Toffee Nut", "Hazelnut", "Honey", "Apple Brown Sugar", "Pepppermint",
    "Pecan", "Chai", "Coffee Base", "Creme Base", "Dark Caramel", "White Mocha",
    "Pumpkin Sauce"
  ],
  cups: [
    "Short Cups (8oz)", "Shot Cup Lids (8oz)", "Tall Hot Cups (12oz)",
    "Tall Hot Lids (12oz)", "Tall Ice Cups (12oz)", "Tall Ice Lids (12oz)",
    "Grande Hot Cups (16oz)", "Grande Hot Lids (16oz)", "Grande Ice Cups (16oz)",
    "Grande Ice Lids (16oz)", "Grande Dome Lids", "Venti Hot Cups (20oz)",
    "Venti Hot Lids (20oz)", "Venti Ice Cups (26oz)", "Venti Ice Lids (26oz)",
    "Venti Dome Lids", "Trenta Cups (30oz)", "Trenta Lids (30oz)"
  ],
  rtd: [
    "Thats it Bars (blueberry)", "Thats it Bars (mango)", "SkinnyDip (lemon)",
    "SkinnyDip (chocolate)", "Kind Bars", "Perfect Bars (chocolate)",
    "Perfect Bars (pb)", "Vanilla Almond Biscoti", "Cheese Trio Bistro",
    "Cheddar & Salami Bistro", "Egg Gouda Bistro", "Horizon Lowfat Milk",
    "Horizon Chocolate Milk", "Apple Juice Box", "Peter Rabbit Strawberry Banana",
    "TripleShot Energy", "Koia Vanilla Bean", "Koia Cacao Bean",
    "Olipop Classic Root Beer", "Olipop Grape", "Starbucks Popcorn",
    "Salted Chips", "Ethos"
  ],
  warming: [
    "Core Warming Bag", "Pastry Bag", "Panini Bag", "Warming Paper", "Forks",
    "Spoons", "Knives", "Egg Trays", "Oatmeal", "Oatmeal (cup)", "Oatmeal(lid)",
    "Sugar in raw", "Honey Packets", "Splenda", "Stevia", "Domino Sugar",
    "Core Shopping Bags (small)", "Core Shopping Bags(Medium)"
  ],
  toppings: [
    "Crunch Toppings", "Cookie Crumbles", "Cinnamon", "Pumpkin"
  ],
  refresher: [
    "Strawberry Acai", "Mango DF", "BlackBerry Sage", "Strawberry Inclusions",
    "Mango DF Inclusions", "Blackberry Sage Inclusions", "Peach", "Lemonade",
    "Strawberry Puree"
  ],
  coffee: [
    "Pike Place", "Veranda", "Verona", "Espresso", "Blonde Espresso",
    "DCF Espresso", "Cold Brew", "Iced Coffee"
  ],
  teas: [
    "Chamomile Mint Blossom", "Mint Majesty", "Emperor's Cloud & Mist",
    "English Breakfast", "Earl Grey", "Chai", "Ice Black Tea", "Ice Green Tea",
    "Ice Passion Tea"
  ],
  cleaning: [
    "Saniwipes", "Rags", "Thermoplan Pills", "Oven Cleaner", "Grease Express",
    "Restroom Cleaner", "InstaSense Multi-Purpose Cleaner", "K-5 Cleaner/Sanitizer",
    "Urn Cleaner", "Peroxide Multi Surface Cleaner and Disinfectant",
    "Sanitizing Wash n Walk", "Sink and Surface Cleaner Sanitizer",
    "10-Inch Paper Tower Roll", "Starbucks Napkins", "Trifold Napkins",
    "Ecolab Foam Hand Soap"
  ],
  misc: [
    "Vanilla Bean Powder", "Matcha", "Chocolate Malt Powder", "Mocha",
    "Frap Chips", "Caramel Drizzle", "Sleeves", "Cup Holders", "Thermometers",
    "Cold Brew Filters", "Coffee Filters", "Whip Chargers", "Brillo Pads"
  ],
  merch: [
    "Discovery Mugs", "Coffee Bags"
  ]
};

function renderInventoryUI() {
  const container = document.getElementById('categories-container');
  container.innerHTML = '';
  // Use this explicit ordering for the sections
  const categoryOrder = ["milks", "syrups", "cups", "rtd", "warming", "toppings", "refresher", "coffee", "teas", "cleaning", "misc", "merch"];
  
  categoryOrder.forEach(category => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category';
    const categoryTitle = document.createElement('h2');
    categoryTitle.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    categoryDiv.appendChild(categoryTitle);
    const itemList = document.createElement('ul');
    itemList.className = 'item-list';
    itemList.id = `${category}-list`;
    
    // Render default items
    inventoryCategories[category].forEach(item => {
      const listItem = createInventoryItem(category, item);
      itemList.appendChild(listItem);
    });
    
    categoryDiv.appendChild(itemList);
    const sectionActions = document.createElement('div');
    sectionActions.className = 'section-actions';
    const addButton = document.createElement('button');
    addButton.className = 'btn btn-add';
    addButton.textContent = 'Add Item';
    addButton.onclick = () => addNewItem(category);
    const clearButton = document.createElement('button');
    clearButton.className = 'btn clear-section';
    clearButton.textContent = 'Clear Section';
    clearButton.onclick = () => clearSection(category);
    sectionActions.appendChild(addButton);
    sectionActions.appendChild(clearButton);
    categoryDiv.appendChild(sectionActions);
    container.appendChild(categoryDiv);
  });
}

// Modified loadInitialData to persist custom items
function loadInitialData() {
  database.ref('inventory/' + selectedStore).once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data) {
      for (const category in data) {
        const itemList = document.getElementById(`${category}-list`);
        if (itemList) {
          Object.keys(data[category]).forEach(itemName => {
            const value = data[category][itemName];
            let input = itemList.querySelector(`input[data-item="${itemName}"]`);
            if (input) {
              // Update the quantity if element exists
              input.value = value;
            } else {
              // Create the item element if it doesn't exist (persist custom items)
              const newItem = createInventoryItem(category, itemName, value);
              itemList.appendChild(newItem);
              if (!inventoryCategories[category].includes(itemName)) {
                inventoryCategories[category].push(itemName);
              }
            }
          });
        }
      }
    }
  });
  database.ref('inventory/' + selectedStore).on('child_changed', (snapshot) => {
    const category = snapshot.key;
    const data = snapshot.val();
    const itemList = document.getElementById(`${category}-list`);
    if (itemList) {
      for (const itemName in data) {
        const itemValue = data[itemName];
        const input = itemList.querySelector(`input[data-item="${itemName}"]`);
        if (input) {
          input.value = itemValue;
        }
      }
    }
  });
}

function setupNotes() {
  const textarea = document.getElementById('notes-textarea');
  const saveBtn = document.getElementById('save-notes-btn');
  database.ref('notes/' + selectedStore).once('value').then((snapshot) => {
    if (snapshot.exists()) {
      textarea.value = snapshot.val();
    }
  });
  database.ref('notes/' + selectedStore).on('value', (snapshot) => {
    if (snapshot.exists()) {
      textarea.value = snapshot.val();
    }
  });
  saveBtn.addEventListener('click', () => {
    const notesText = textarea.value.trim();
    database.ref('notes/' + selectedStore).set(notesText)
      .then(() => showPopup('Notes saved!'))
      .catch(error => showPopup('Error saving notes: ' + error.message));
  });
  let typingTimer;
  textarea.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      const notesText = textarea.value.trim();
      database.ref('notes/' + selectedStore).set(notesText)
        .catch(error => console.error('Error auto-saving notes:', error));
    }, 2000);
  });
}

function createInventoryItem(category, itemName, itemValue = '') {
  const item = document.createElement('li');
  item.className = 'item';
  const label = document.createElement('div');
  label.className = 'item-label';
  label.textContent = itemName;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'item-input';
  input.placeholder = 'Enter quantity...';
  input.value = itemValue;
  input.dataset.category = category;
  input.dataset.item = itemName;
  input.addEventListener('change', function() {
    const value = this.value.trim();
    updateInventoryItem(category, itemName, value);
  });
  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-remove';
  removeBtn.textContent = 'Remove';
  removeBtn.onclick = () => removeInventoryItem(category, itemName, item);
  const itemActions = document.createElement('div');
  itemActions.className = 'item-actions';
  itemActions.appendChild(removeBtn);
  item.appendChild(label);
  item.appendChild(input);
  item.appendChild(itemActions);
  return item;
}

async function addNewItem(category) {
  const newItemName = prompt('Enter new item name:');
  if (newItemName && newItemName.trim() !== '') {
    const itemList = document.getElementById(`${category}-list`);
    const newItem = createInventoryItem(category, newItemName);
    itemList.appendChild(newItem);
    database.ref(`inventory/${selectedStore}/${category}/${newItemName}`).set('');
    if (!inventoryCategories[category].includes(newItemName)) {
      inventoryCategories[category].push(newItemName);
    }
  }
}

async function removeInventoryItem(category, itemName, itemElement) {
  if (await customConfirm(`Are you sure you want to remove ${itemName}?`)) {
    database.ref(`inventory/${selectedStore}/${category}/${itemName}`).remove();
    itemElement.remove();
    const index = inventoryCategories[category].indexOf(itemName);
    if (index > -1) {
      inventoryCategories[category].splice(index, 1);
    }
  }
}

async function clearSection(category) {
  if (await customConfirm(`Are you sure you want to clear all quantities in ${category}?`)) {
    const inputs = document.querySelectorAll(`#${category}-list .item-input`);
    inputs.forEach(input => {
      input.value = '';
      const itemName = input.dataset.item;
      updateInventoryItem(category, itemName, '');
    });
  }
}

function updateInventoryItem(category, itemName, value) {
  database.ref(`inventory/${selectedStore}/${category}/${itemName}`).set(value);
}

// Updated generateInventoryList function that reads the DOM order
function generateInventoryList() {
  let output = "";
  // Define the desired category order explicitly:
  const categoryOrder = ["milks", "syrups", "cups", "rtd", "warming", "toppings", "refresher", "coffee", "teas", "cleaning", "misc", "merch"];
  
  categoryOrder.forEach(category => {
    const itemList = document.getElementById(`${category}-list`);
    if (itemList) {
      const categoryDiv = itemList.parentElement;
      const headerElem = categoryDiv.querySelector("h2");
      if (!headerElem) return;
      
      const categoryName = headerElem.textContent;
      let categoryOutput = categoryName + ":\n";
      let categoryHasItems = false;
      
      // Read the current value from each item in this category based on DOM order
      const items = categoryDiv.querySelectorAll(".item");
      items.forEach(item => {
        const labelElem = item.querySelector(".item-label");
        const inputElem = item.querySelector(".item-input");
        if (!labelElem || !inputElem) return;
        
        const itemValue = inputElem.value.trim();
        if (itemValue !== "") {
          categoryOutput += `${labelElem.textContent}: ${itemValue}\n`;
          categoryHasItems = true;
        }
      });
      
      if (categoryHasItems) {
        output += categoryOutput + "\n";
      }
    }
  });
  
  document.getElementById("output-content").textContent = output || "No items in inventory.";
}

// Modified copyInventoryList uses a fallback method if needed
function copyInventoryList() {
  const outputContent = document.getElementById('output-content').textContent;
  if (outputContent.trim() === '') {
    showPopup('Please generate a list first.');
    return;
  }
  
  // Use Clipboard API if available and secure; otherwise, use fallback
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(outputContent)
      .then(() => showPopup('List copied to clipboard!'))
      .catch(err => showPopup('Failed to copy: ' + err));
  } else {
    // Fallback for insecure context
    let textArea = document.createElement("textarea");
    textArea.value = outputContent;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showPopup('List copied to clipboard!');
    } catch (err) {
      showPopup('Failed to copy: ' + err);
    }
    document.body.removeChild(textArea);
  }
}

async function clearInventory() {
  if (await customConfirm('Are you sure you want to clear all inventory items? This cannot be undone.')) {
    database.ref('inventory/' + selectedStore).remove()
      .then(() => {
        document.getElementById('output-content').textContent = 'Inventory cleared.';
        const inputs = document.querySelectorAll('.item-input');
        inputs.forEach(input => { input.value = ''; });
      })
      .catch(error => showPopup('Error clearing inventory: ' + error.message));
  }
}

function setupEventListeners() {
  document.getElementById('generate-btn').addEventListener('click', generateInventoryList);
  document.getElementById('copy-btn').addEventListener('click', copyInventoryList);
  document.getElementById('clear-btn').addEventListener('click', clearInventory);
}

/**************************************/
/*             admin.js               */
/**************************************/
function renderAdminUI() {
  document.getElementById('admin-container').style.display = 'block';
}

document.getElementById('update-password-btn').addEventListener('click', async function() {
  const roleSelect = document.getElementById('password-role-select');
  const newPwdInput = document.getElementById('new-password-input');
  const selectedRole = roleSelect.value;
  const newPassword = newPwdInput.value.trim();
  if (!newPassword) {
    showPopup("Please enter a new password.");
    return;
  }
  if (selectedRole === "manager") {
    managerPassword = await hashPassword(newPassword);
  } else {
    storePasswords[selectedRole] = await hashPassword(newPassword);
  }
  database.ref('passwords').set({
    manager: managerPassword,
    store: storePasswords
  }).then(() => {
    showPopup("Password updated successfully.");
    newPwdInput.value = '';
  }).catch(err => showPopup("Error updating password: " + err.message));
});

document.getElementById('reset-password-btn').addEventListener('click', async function() {
  if (await customConfirm("Are you sure you want to reset all passwords to default?")) {
    managerPassword = await hashPassword(DEFAULT_MANAGER_PASSWORD);
    const newStorePasswords = {};
    for (const store in DEFAULT_STORE_PASSWORDS) {
      newStorePasswords[store] = await hashPassword(DEFAULT_STORE_PASSWORDS[store]);
    }
    storePasswords = newStorePasswords;
    database.ref('passwords').set({
      manager: managerPassword,
      store: storePasswords
    }).then(() => {
      showPopup("All passwords have been reset to default.");
    }).catch(err => showPopup("Error resetting passwords: " + err.message));
  }
});

document.getElementById('sign-out-all-btn').addEventListener('click', async function() {
  if (await customConfirm("This will sign out everyone currently using the app. Proceed?")) {
    database.ref('global/signOutTrigger').set(Date.now())
      .then(() => showPopup("All users have been signed out."))
      .catch(error => showPopup("Error signing out users: " + error.message));
  }
});

/**************************************/
/*              main.js               */
/**************************************/
function updateHeadingAndLoadData(store) {
  const headingText = (currentRole === "manager" ? "Manager" : "Lead") + " - " + store + " Inventory Management";
  document.getElementById('main-heading').textContent = headingText;
  document.getElementById('main-container').style.display = 'block';
  renderInventoryUI();
  loadInitialData();
  setupNotes();
  setupEventListeners();
}

// Switch Store Button Event Listener
document.getElementById('switch-store-btn').addEventListener('click', async function() {
  if (await customConfirm("Switch store? Unsaved changes might be lost.")) {
    // Remove only the store selection so that the role remains intact
    localStorage.removeItem("selectedStore");
    selectedStore = "";
    // Hide the main container containing the inventory UI
    document.getElementById('main-container').style.display = 'none';
    // Show the store selection overlay for new store selection
    document.getElementById('store-selection').style.display = 'flex';
  }
});

// Global Sign Out Listener
database.ref('global/signOutTrigger').on('value', (snapshot) => {
  if (snapshot.exists() && snapshot.val()) {
    goHome();
  }
});

// Persistent Session Check
document.addEventListener('DOMContentLoaded', async function() {
  await loadPasswords();
  const storedRole = localStorage.getItem("userRole");
  const storedStore = localStorage.getItem("selectedStore");
  if (storedRole && storedStore) {
    currentRole = storedRole;
    selectedStore = storedStore;
    document.getElementById('role-selection').style.display = 'none';
    document.getElementById('manager-password-screen').style.display = 'none';
    document.getElementById('store-selection').style.display = 'none';
    document.getElementById('store-password-screen').style.display = 'none';
    if (currentRole === "admin") {
      renderAdminUI();
    } else {
      updateHeadingAndLoadData(storedStore);
    }
  }
});
