// State Management
const state = {
    currentDate: new Date(),
    selectedDateStr: null,
    data: {}
};

// DOM Elements
const calendarGrid = document.getElementById('calendar');
const monthYearDisplay = document.getElementById('currentMonthYear');
const modal = document.getElementById('entryModal');
const selectedDateDisplay = document.getElementById('selectedDateDisplay');

// Inputs
const textA = document.getElementById('textA');
const textB = document.getElementById('textB');
const imgInputA = document.getElementById('imgInputA');
const imgInputB = document.getElementById('imgInputB');
const previewA = document.getElementById('previewA');
const previewB = document.getElementById('previewB');

// Temporary image storage (Arrays now!)
let tempImgsA = [];
let tempImgsB = [];

// --- Firebase Integration (Keep your existing Firebase config/code in HTML) ---

window.addEventListener('firebase-ready', () => {
    const dataRef = window.dbRef(window.db, 'journal_entries');
    window.dbOnValue(dataRef, (snapshot) => {
        const cloudData = snapshot.val();
        state.data = cloudData || {};
        renderCalendar();
        if (modal.classList.contains('active') && state.selectedDateStr) {
            // Only refresh if we aren't typing (simple debounce check)
            if(document.activeElement !== textA && document.activeElement !== textB) {
                loadEntryData(state.selectedDateStr);
            }
        }
    });
});

// --- Calendar Logic ---
const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');

// 1. Initialize Dropdowns
function initSelectors() {
    // Populate Months
    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    
    monthNames.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.text = month;
        monthSelect.appendChild(option);
    });

    // Populate Years (e.g., 1950 to 2050)
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 50; i <= currentYear + 20; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.text = i;
        yearSelect.appendChild(option);
    }

    // Add Listeners
    monthSelect.addEventListener('change', () => jumpToDate());
    yearSelect.addEventListener('change', () => jumpToDate());
}

// 2. Handle Dropdown Changes
function jumpToDate() {
    const newMonth = parseInt(monthSelect.value);
    const newYear = parseInt(yearSelect.value);
    
    // Set date to 1st to avoid overflow issues (e.g. going from Jan 31 to Feb)
    state.currentDate.setDate(1); 
    state.currentDate.setMonth(newMonth);
    state.currentDate.setFullYear(newYear);
    
    renderCalendar();
}

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();

    // UPDATE: Sync dropdowns with current state (in case arrows were clicked)
    monthSelect.value = month;
    yearSelect.value = year;

    // (The rest of renderCalendar remains exactly the same...)
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        const div = document.createElement('div');
        div.classList.add('day', 'empty');
        calendarGrid.appendChild(div);
    }

    for (let i = 1; i <= lastDay; i++) {
        const div = document.createElement('div');
        div.innerText = i;
        div.classList.add('day');
        
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        
        if (state.data[dateKey]) div.classList.add('has-entry');

        const today = new Date();
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            div.classList.add('today');
        }

        div.addEventListener('click', () => openModal(dateKey));
        calendarGrid.appendChild(div);
    }
}

// Call init once at startup
initSelectors();

document.getElementById('prevBtn').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('nextBtn').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
});

// --- Modal & Data Logic ---

function openModal(dateKey) {
    state.selectedDateStr = dateKey;
    selectedDateDisplay.innerText = new Date(dateKey).toDateString();
    loadEntryData(dateKey);
    modal.classList.add('active');
}

function loadEntryData(dateKey) {
    const entry = state.data[dateKey] || { personA: {}, personB: {} };
    
    textA.value = entry.personA?.text || '';
    textB.value = entry.personB?.text || '';
    
    // Ensure we handle old data (single string) vs new data (array)
    const imgsA = entry.personA?.images || (entry.personA?.image ? [entry.personA.image] : []);
    const imgsB = entry.personB?.images || (entry.personB?.image ? [entry.personB.image] : []);

    tempImgsA = [...imgsA];
    tempImgsB = [...imgsB];
    
    renderImages(previewA, tempImgsA, 'A');
    renderImages(previewB, tempImgsB, 'B');
}

function renderImages(container, imageArray, personId) {
    container.innerHTML = '';
    imageArray.forEach((src, index) => {
        const div = document.createElement('div');
        div.classList.add('img-card');
        
        const img = document.createElement('img');
        img.src = src;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.classList.add('delete-img-btn');
        deleteBtn.onclick = () => removeImage(index, personId);

        div.appendChild(img);
        div.appendChild(deleteBtn);
        container.appendChild(div);
    });
}

function removeImage(index, personId) {
    if (personId === 'A') {
        tempImgsA.splice(index, 1);
        renderImages(previewA, tempImgsA, 'A');
    } else {
        tempImgsB.splice(index, 1);
        renderImages(previewB, tempImgsB, 'B');
    }
}

// Image handling (Compress & Add to Array)
function handleImageUpload(e, isPersonA) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Resize logic (Max 600px)
                const maxSize = 600;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                } else {
                    if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedData = canvas.toDataURL('image/jpeg', 0.7);
                
                if (isPersonA) {
                    tempImgsA.push(compressedData);
                    renderImages(previewA, tempImgsA, 'A');
                } else {
                    tempImgsB.push(compressedData);
                    renderImages(previewB, tempImgsB, 'B');
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
    
    // Reset input so you can select the same file again if needed
    e.target.value = '';
}

imgInputA.addEventListener('change', (e) => handleImageUpload(e, true));
imgInputB.addEventListener('change', (e) => handleImageUpload(e, false));

// Save Data to Cloud
document.getElementById('saveBtn').addEventListener('click', () => {
    if (!state.selectedDateStr) return;

    const newData = {
        personA: { text: textA.value, images: tempImgsA },
        personB: { text: textB.value, images: tempImgsB }
    };

    window.dbSet(window.dbRef(window.db, 'journal_entries/' + state.selectedDateStr), newData)
        .then(() => {
            alert('บันทึกสำเร็จ!');
            modal.classList.remove('active');
        })
        .catch((error) => {
            console.error(error);
            alert('Error: ' + error.message);
        });
});

document.getElementById('closeModal').addEventListener('click', () => {
    modal.classList.remove('active');
});

renderCalendar();

document.getElementById('deleteBtn').addEventListener('click', () => {
    if (!state.selectedDateStr) return;

    // 1. Confirm with the user (Important!)
    const isConfirmed = confirm("ต้องการลบจริงๆหรือไม่ ถ้าลบแล้วหายเลยนะ!");
    
    if (isConfirmed) {
        // 2. Delete from Firebase by setting data to null
        window.dbSet(window.dbRef(window.db, 'journal_entries/' + state.selectedDateStr), null)
            .then(() => {
                // 3. Clear local Inputs immediately for visual feedback
                textA.value = '';
                textB.value = '';
                tempImgsA = [];
                tempImgsB = [];
                renderImages(previewA, [], 'A');
                renderImages(previewB, [], 'B');

                // 4. Close modal and notify
                modal.classList.remove('active');
                // The onValue listener will automatically update the calendar dots
            })
            .catch((error) => {
                alert("Error deleting: " + error.message);
            });
    }
});

document.querySelector('.controls').style.display = 'flex'; 

document.getElementById('todayBtn').addEventListener('click', () => {
    // 1. Reset state to current real time
    state.currentDate = new Date();
    
    // 2. Refresh the calendar
    renderCalendar();
    
    // 3. Visual feedback (Optional: shake animation or alert)
    // You'll see the dropdowns automatically update to the current month/year
});