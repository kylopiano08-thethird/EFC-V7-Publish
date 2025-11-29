// scripts/admin-tools.js
class AdminTools {
    constructor() {
        this.isAdmin = true;
        console.log('AdminTools initialized');
    }

     goToMainPage() {
        window.location.href = 'index.html';
    }

    initializeAdminPage() {
        console.log('=== INITIALIZING ADMIN PAGE ===');
        
        // FORCE race calendar to load data
        if (window.raceCalendar) {
            console.log('BEFORE - Races count:', window.raceCalendar.races.length);
            console.log('BEFORE - Races:', window.raceCalendar.races);
            
            // Remove async/await since loadRacesFromResults might not be async
            window.raceCalendar.loadRacesFromResults().then(() => {
                window.raceCalendar.findNextRace();
                
                console.log('AFTER - Races count:', window.raceCalendar.races.length);
                console.log('AFTER - Races:', window.raceCalendar.races);
            }).catch(error => {
                console.error('Error loading races:', error);
            });
        }
        
        this.setupAdminTabs();
        this.loadCircuitList();
        this.updateDebugInfo();
        
        this.showNotification('Admin dashboard loaded!', 'success');
    }

    // Add to admin-tools.js
    setRaceDate() {
        if (!window.raceCalendar || !window.raceCalendar.races.length) {
            this.showNotification('No races available to update', 'error');
            return;
        }

        const raceOptions = window.raceCalendar.races.map(race => 
            `<option value="${race.name}">${race.name}</option>`
        ).join('');

        const modalHTML = `
            <div class="circuit-edit-modal">
                <div class="circuit-edit-content">
                    <div class="circuit-edit-header">
                        <h3>Set Race Date</h3>
                        <button class="close-modal" onclick="adminTools.closeCircuitModal()">×</button>
                    </div>
                    
                    <form id="race-date-form" class="circuit-edit-form">
                        <div class="form-section">
                            <div class="form-group">
                                <label>Select Race</label>
                                <select name="raceName" required>
                                    ${raceOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Race Date</label>
                                <input type="date" name="raceDate" required>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="save-btn">💾 Set Race Date</button>
                            <button type="button" class="cancel-btn" onclick="adminTools.closeCircuitModal()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        document.getElementById('race-date-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const raceName = formData.get('raceName');
            const raceDate = formData.get('raceDate');
            
            this.saveRaceDate(raceName, raceDate);
        });
    }

    saveRaceDate(raceName, dateString) {
        const race = window.raceCalendar.races.find(r => r.name === raceName);
        if (race) {
            race.date = new Date(dateString);
            // Save to localStorage
            localStorage.setItem('efc_race_dates', JSON.stringify(
                window.raceCalendar.races.reduce((dates, r) => {
                    dates[r.name] = r.date;
                    return dates;
                }, {})
            ));
            this.showNotification(`Date set for ${raceName}`, 'success');
            this.closeCircuitModal();
            window.raceCalendar.displayFullCalendar();
        }
    }

    setupAdminTabs() {
        console.log('Setting up admin tabs...');
        const tabs = document.querySelectorAll('.admin-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                console.log('Tab clicked:', tab.dataset.tab);
                
                // Remove active class from all
                document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
                
                // Add active to clicked
                tab.classList.add('active');
                const tabId = tab.dataset.tab + '-tab';
                document.getElementById(tabId).classList.add('active');
                
                // Load tab-specific content
                if (tab.dataset.tab === 'circuit-editor') {
                    this.loadCircuitList();
                } else if (tab.dataset.tab === 'system-tools') {
                    this.updateDebugInfo();
                } else if (tab.dataset.tab === 'poll-management') {
                    this.updatePollStats();
                }
            });
        });
    }

    loadCircuitList() {
        console.log('Loading circuit list...');
        const circuitList = document.getElementById('circuit-list');
        if (!circuitList) return;

        // Get races from the calendar that's already loaded
        let circuitNames = this.getRacesFromCalendar();
        
        if (circuitNames.length === 0) {
            circuitList.innerHTML = `
                <div class="no-circuits">
                    <p>No races found. The calendar might not be loaded yet.</p>
                    <p><small>Go to the main page and open the Race Calendar first, then come back here.</small></p>
                </div>
            `;
            return;
        }

        this.renderCircuitList(circuitNames, circuitList);
    }

    getRacesFromCalendar() {
        // SIMPLE FIX: Check if raceCalendar exists and has races
        if (window.raceCalendar && window.raceCalendar.races && window.raceCalendar.races.length > 0) {
            return window.raceCalendar.races.map(race => race.name);
        }
        
        // Fallback: return some default circuit names for testing
        return [
            'Monaco Grand Prix',
            'Silverstone Grand Prix', 
            'Spa Grand Prix',
            'Monza Grand Prix',
            'Suzuka Grand Prix'
        ];
    }

    renderCircuitList(circuitNames, circuitList) {
        const circuitData = window.raceCalendar ? window.raceCalendar.circuitData : {};
        
        circuitList.innerHTML = circuitNames.map(circuitName => {
            const circuit = circuitData[circuitName] || {};
            const hasData = circuit.circuit && circuit.circuit.trim() !== '';
            
            return `
                <div class="circuit-editor-item">
                    <div class="circuit-editor-header">
                        <div class="circuit-title">
                            <h4>${circuitName}</h4>
                            <span class="circuit-status ${hasData ? 'complete' : 'incomplete'}">
                                ${hasData ? '✅ Complete' : '⚠️ Needs Info'}
                            </span>
                        </div>
                        <button class="edit-circuit-btn" onclick="adminTools.editCircuit('${circuitName}')">
                            ${hasData ? '✏️ Edit' : '➕ Add'} Circuit Info
                        </button>
                    </div>
                    ${hasData ? `
                        <div class="circuit-preview">
                            <div class="preview-grid">
                                <div class="preview-item">
                                    <strong>Circuit:</strong> ${circuit.circuit}
                                </div>
                                <div class="preview-item">
                                    <strong>Location:</strong> ${circuit.city || 'N/A'}, ${circuit.country || 'N/A'}
                                </div>
                            </div>
                        </div>
                    ` : '<div class="circuit-preview missing">Click "Add Circuit Info" to set up this circuit</div>'}
                </div>
            `;
        }).join('');
    }

    editCircuit(circuitName) {
        const circuitData = window.raceCalendar ? window.raceCalendar.circuitData[circuitName] || {} : {};
        
        const modalHTML = `
            <div class="circuit-edit-modal">
                <div class="circuit-edit-content">
                    <div class="circuit-edit-header">
                        <h3>${circuitName}</h3>
                        <button class="close-modal" onclick="adminTools.closeCircuitModal()">×</button>
                    </div>
                    
                    <form id="circuit-edit-form" class="circuit-edit-form">
                        <input type="hidden" name="circuitName" value="${circuitName}">
                        
                        <div class="form-section">
                            <h4>Circuit Information</h4>
                            <div class="form-group">
                                <label>Circuit Name</label>
                                <input type="text" name="circuit" value="${circuitData.circuit || ''}" 
                                       placeholder="e.g., Albert Park Circuit">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Country</label>
                                    <input type="text" name="country" value="${circuitData.country || ''}" 
                                           placeholder="e.g., Australia">
                                </div>
                                <div class="form-group">
                                    <label>City</label>
                                    <input type="text" name="city" value="${circuitData.city || ''}" 
                                           placeholder="e.g., Melbourne">
                                </div>
                            </div>
                        </div>

                        <div class="form-section">
                            <h4>Track Specifications</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Circuit Length</label>
                                    <input type="text" name="length" value="${circuitData.length || ''}" 
                                           placeholder="e.g., 5.303 km">
                                </div>
                                <div class="form-group">
                                    <label>Number of Laps</label>
                                    <input type="number" name="laps" value="${circuitData.laps || ''}" 
                                           placeholder="e.g., 58">
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Race Distance</label>
                                    <input type="text" name="distance" value="${circuitData.distance || ''}" 
                                           placeholder="e.g., 307.574 km">
                                </div>
                                <div class="form-group">
                                    <label>Number of Corners</label>
                                    <input type="number" name="corners" value="${circuitData.corners || ''}" 
                                           placeholder="e.g., 16">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Lap Record</label>
                                <input type="text" name="lapRecord" value="${circuitData.lapRecord || ''}" 
                                       placeholder="e.g., 1:30.556 (Max Verstappen, 2023)">
                            </div>
                        </div>

                        <div class="form-section">
                            <h4>Media & Additional Info</h4>
                            <div class="form-group">
                                <label>Circuit Image URL</label>
                                <input type="url" name="image" value="${circuitData.image || ''}" 
                                       placeholder="https://example.com/track-layout.jpg">
                            </div>
                            <div class="form-group">
                                <label>First Grand Prix</label>
                                <input type="text" name="firstGrandPrix" value="${circuitData.firstGrandPrix || ''}" 
                                       placeholder="e.g., 1996">
                            </div>
                            <div class="form-group">
                                <label>Capacity</label>
                                <input type="text" name="capacity" value="${circuitData.capacity || ''}" 
                                       placeholder="e.g., 120,000">
                            </div>
                            <div class="form-group">
                                 <label>Race Time (Local)</label>
                                <input type="text" name="timezone" value="${circuitData.timezone || ''}" 
                                        placeholder="e.g., 14:00 Local Time">
                            </div>

                            <div class="form-group">
                                <label>Track Description</label>
                                <textarea name="description" placeholder="Describe the circuit layout, characteristics, and challenges..." style="height: 120px;">${circuitData.description || ''}</textarea>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="save-btn">💾 Save Circuit Info</button>
                            <button type="button" class="cancel-btn" onclick="adminTools.closeCircuitModal()">Cancel</button>
                            ${circuitData.circuit ? `
                                <button type="button" class="delete-btn" onclick="adminTools.deleteCircuit('${circuitName}')">🗑️ Delete</button>
                            ` : ''}
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Handle form submission
        document.getElementById('circuit-edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCircuitData(new FormData(e.target));
        });
    }

    saveCircuitData(formData) {
        const circuitName = formData.get('circuitName');
        const circuitData = {
            circuit: formData.get('circuit'),
            country: formData.get('country'),
            city: formData.get('city'),
            image: formData.get('image'),
            description: formData.get('description'),
            length: formData.get('length'),
            laps: formData.get('laps'),
            distance: formData.get('distance'),
            corners: formData.get('corners'),
            lapRecord: formData.get('lapRecord'),
            firstGrandPrix: formData.get('firstGrandPrix'),
            capacity: formData.get('capacity'),
            timezone: formData.get('timezone')
        };
        
        // Validate required fields
        if (!circuitData.circuit || !circuitData.country || !circuitData.city) {
            this.showNotification('Please fill in all required fields (Circuit Name, Country, City)', 'error');
            return;
        }
        
        // Save to race calendar
        if (window.raceCalendar) {
            window.raceCalendar.updateCircuitData(circuitName, circuitData);
            this.showNotification('Circuit information saved successfully!', 'success');
            this.closeCircuitModal();
            this.loadCircuitList();
            
            // Refresh the main calendar if it's open
            if (window.raceCalendar.displayFullCalendar) {
                window.raceCalendar.displayFullCalendar();
            }
        } else {
            this.showNotification('Error: Race calendar not available', 'error');
        }
    }

    deleteCircuit(circuitName) {
        if (confirm(`Are you sure you want to delete circuit information for "${circuitName}"?`)) {
            if (window.raceCalendar && window.raceCalendar.circuitData[circuitName]) {
                delete window.raceCalendar.circuitData[circuitName];
                localStorage.setItem('efc_circuit_data', JSON.stringify(window.raceCalendar.circuitData));
                this.showNotification('Circuit information deleted!', 'success');
                this.closeCircuitModal();
                this.loadCircuitList();
            }
        }
    }

    closeCircuitModal() {
        const modal = document.querySelector('.circuit-edit-modal');
        if (modal) modal.remove();
    }

    // Circuit Management Actions
    updateCalendar() {
        if (window.raceCalendar) {
            window.raceCalendar.loadRacesFromResults().then(() => {
                window.raceCalendar.findNextRace();
                this.loadCircuitList();
                this.showNotification('Calendar refreshed from race results!', 'success');
            }).catch(error => {
                this.showNotification('Error refreshing calendar: ' + error.message, 'error');
            });
        } else {
            this.showNotification('Race calendar not available', 'error');
        }
    }

    exportCircuitData() {
        if (window.raceCalendar && Object.keys(window.raceCalendar.circuitData).length > 0) {
            const dataStr = JSON.stringify(window.raceCalendar.circuitData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `efc-circuit-data-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
            this.showNotification('Circuit data exported successfully!', 'success');
        } else {
            this.showNotification('No circuit data to export', 'warning');
        }
    }

    importCircuitData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const circuitData = JSON.parse(event.target.result);
                        if (window.raceCalendar) {
                            window.raceCalendar.circuitData = circuitData;
                            localStorage.setItem('efc_circuit_data', JSON.stringify(circuitData));
                            this.loadCircuitList();
                            this.showNotification('Circuit data imported successfully!', 'success');
                        }
                    } catch (error) {
                        this.showNotification('Error importing circuit data: Invalid JSON', 'error');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    clearCache() {
        localStorage.removeItem('efc_circuit_data');
        if (window.raceCalendar) {
            window.raceCalendar.circuitData = {};
        }
        this.loadCircuitList();
        this.showNotification('Circuit cache cleared!', 'success');
    }

    // System methods
    updateDebugInfo() {
        const circuitCount = window.raceCalendar ? Object.keys(window.raceCalendar.circuitData).length : 0;
        const raceCount = window.raceCalendar ? window.raceCalendar.races.length : 0;
        
        const elements = {
            'last-refresh': new Date().toLocaleString(),
            'cache-size': Math.round((localStorage.getItem('efc_circuit_data') || '').length / 1024) + ' KB',
            'admin-session': `Active - ${circuitCount}/${raceCount} circuits configured`
        };
        
        Object.keys(elements).forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = elements[id];
        });
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.admin-notification').forEach(notif => notif.remove());
        
        const notification = document.createElement('div');
        notification.className = `admin-notification admin-notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 4000);
    }

    // Other admin actions
    addTestRace() {
        this.showNotification('Test race functionality coming soon!', 'info');
    }

    simulateRace() {
        this.showNotification('Race simulation functionality coming soon!', 'info');
    }

    addDriver() {
        this.showNotification('Add driver functionality coming soon!', 'info');
    }

    updateStandings() {
        this.showNotification('Standings update functionality coming soon!', 'info');
    }

    recalculateRatings() {
        this.showNotification('Ratings recalculation functionality coming soon!', 'info');
    }

    importFromJSON() {
        this.importCircuitData();
    }

    backupSheets() {
        this.showNotification('Google Sheets backup functionality coming soon!', 'info');
    }

    processManualData() {
        this.showNotification('Manual data processing functionality coming soon!', 'info');
    }

    validateData() {
        this.showNotification('Data validation functionality coming soon!', 'info');
    }

    clearManualData() {
        const input = document.getElementById('manual-data-input');
        if (input) input.value = '';
        this.showNotification('Manual data cleared!', 'success');
    }

    reloadAllData() {
        if (window.raceCalendar) {
            window.raceCalendar.init().then(() => {
                this.loadCircuitList();
                this.showNotification('All data reloaded successfully!', 'success');
            });
        }
    }

    forceRecalculate() {
        this.showNotification('Recalculation functionality coming soon!', 'info');
    }

    showDebugInfo() {
        const debugInfo = {
            'Race Calendar': window.raceCalendar ? 'Loaded' : 'Not loaded',
            'Races Count': window.raceCalendar ? window.raceCalendar.races.length : 0,
            'Circuits Configured': window.raceCalendar ? Object.keys(window.raceCalendar.circuitData).length : 0,
            'Next Race': window.raceCalendar && window.raceCalendar.nextRace ? window.raceCalendar.nextRace.name : 'None',
            'Local Storage': Object.keys(localStorage).filter(key => key.startsWith('efc_')).join(', ')
        };
        
        alert('Debug Information:\n' + Object.entries(debugInfo).map(([key, value]) => `${key}: ${value}`).join('\n'));
    }

    logout() {
        localStorage.removeItem('efc_admin');
        this.showNotification('Logged out successfully', 'info');
        setTimeout(() => window.location.href = 'index.html', 1000);
    }

    // POLL MANAGEMENT METHODS
    managePolls() {
        const modalHTML = `
            <div class="circuit-edit-modal">
                <div class="circuit-edit-content">
                    <div class="circuit-edit-header">
                        <h3>Manage Polls</h3>
                        <button class="close-modal" onclick="adminTools.closeCircuitModal()">×</button>
                    </div>
                    
                    <div class="admin-tabs" style="margin: -25px -25px 25px -25px; width: calc(100% + 50px);">
                        <button class="admin-tab active" onclick="adminTools.switchPollTab('create')">Create Poll</button>
                        <button class="admin-tab" onclick="adminTools.switchPollTab('manage')">Manage Polls</button>
                    </div>
                    
                    <div id="poll-create-tab" class="poll-tab-content active">
                        <form id="create-poll-form" class="circuit-edit-form">
                            <div class="form-section">
                                <div class="form-group">
                                    <label>Poll Question</label>
                                    <input type="text" name="question" required placeholder="Enter your poll question...">
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>End Date</label>
                                        <input type="date" name="endDate" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Status</label>
                                        <select name="status">
                                            <option value="live">Live</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>Poll Options</h4>
                                <div id="poll-options-container">
                                    <div class="form-group">
                                        <input type="text" name="option1" required placeholder="Option 1">
                                    </div>
                                    <div class="form-group">
                                        <input type="text" name="option2" required placeholder="Option 2">
                                    </div>
                                </div>
                                <button type="button" class="admin-btn" onclick="adminTools.addPollOption()" style="margin-top: 10px;">
                                    + Add Option
                                </button>
                            </div>

                            <div class="form-actions">
                                <button type="submit" class="save-btn">📊 Create Poll</button>
                                <button type="button" class="cancel-btn" onclick="adminTools.closeCircuitModal()">Cancel</button>
                            </div>
                        </form>
                    </div>
                    
                    <div id="poll-manage-tab" class="poll-tab-content">
                        <div class="poll-list" id="admin-poll-list">
                            <div class="loading">Loading polls...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.loadAdminPolls();
        
        document.getElementById('create-poll-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createPoll(new FormData(e.target));
        });
    }

    switchPollTab(tabName) {
        document.querySelectorAll('.poll-tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.admin-tabs .admin-tab').forEach(tab => tab.classList.remove('active'));
        
        document.getElementById(`poll-${tabName}-tab`).classList.add('active');
        event.target.classList.add('active');
    }

    addPollOption() {
        const container = document.getElementById('poll-options-container');
        const optionCount = container.children.length + 1;
        
        const optionHTML = `
            <div class="form-group">
                <input type="text" name="option${optionCount}" required placeholder="Option ${optionCount}">
                <button type="button" class="remove-option-btn" onclick="this.parentElement.remove()" style="background: #dc0000; color: white; border: none; padding: 5px 10px; border-radius: 4px; margin-left: 10px; cursor: pointer;">×</button>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', optionHTML);
    }

    loadAdminPolls() {
        const pollList = document.getElementById('admin-poll-list');
        
        try {
            // Load polls from localStorage
            const polls = JSON.parse(localStorage.getItem('efc_polls') || '[]');
            
            if (polls.length === 0) {
                pollList.innerHTML = '<div class="no-circuits">No polls created yet.</div>';
                return;
            }
            
            pollList.innerHTML = polls.map(poll => `
                <div class="circuit-editor-item">
                    <div class="circuit-editor-header">
                        <div class="circuit-title">
                            <h4>${poll.question}</h4>
                            <span class="circuit-status ${poll.status === 'live' ? 'complete' : 'incomplete'}">
                                ${poll.status === 'live' ? '📊 Live' : '🔒 Closed'} • ${poll.totalVotes} votes
                            </span>
                        </div>
                        <div class="circuit-list-actions">
                            <button class="edit-circuit-btn" onclick="adminTools.editPoll(${poll.id})">
                                ✏️ Edit
                            </button>
                            <button class="circuit-action-btn warning" onclick="adminTools.deletePoll(${poll.id})">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                    <div class="circuit-preview">
                        <div class="preview-grid">
                            ${poll.options.map(option => `
                                <div class="preview-item">
                                    <strong>${option.text}:</strong> ${option.votes} votes (${option.percentage}%)
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            pollList.innerHTML = '<div class="error">Error loading polls</div>';
        }
    }

    createPoll(formData) {
        const question = formData.get('question');
        const endDate = formData.get('endDate');
        const status = formData.get('status');
        
        // Collect options
        const options = [];
        let optionIndex = 1;
        while (formData.get(`option${optionIndex}`)) {
            const optionText = formData.get(`option${optionIndex}`);
            if (optionText.trim()) {
                options.push({
                    text: optionText.trim(),
                    votes: 0,
                    percentage: 0
                });
            }
            optionIndex++;
        }
        
        if (options.length < 2) {
            this.showNotification('Please add at least 2 options', 'error');
            return;
        }
        
        const newPoll = {
            id: Date.now(), // Simple ID generation
            question,
            options,
            totalVotes: 0,
            status,
            endDate,
            userVoted: false,
            userSelection: null
        };
        
        // Save to localStorage
        const existingPolls = JSON.parse(localStorage.getItem('efc_polls') || '[]');
        existingPolls.push(newPoll);
        localStorage.setItem('efc_polls', JSON.stringify(existingPolls));
        
        this.showNotification('Poll created successfully!', 'success');
        this.loadAdminPolls();
        this.closeCircuitModal();
    }

    editPoll(pollId) {
        const existingPolls = JSON.parse(localStorage.getItem('efc_polls') || '[]');
        const poll = existingPolls.find(p => p.id === pollId);
        
        if (!poll) {
            this.showNotification('Poll not found', 'error');
            return;
        }
        
        const modalHTML = `
            <div class="circuit-edit-modal">
                <div class="circuit-edit-content">
                    <div class="circuit-edit-header">
                        <h3>Edit Poll</h3>
                        <button class="close-modal" onclick="adminTools.closeCircuitModal()">×</button>
                    </div>
                    
                    <form id="edit-poll-form" class="circuit-edit-form">
                        <input type="hidden" name="pollId" value="${poll.id}">
                        
                        <div class="form-section">
                            <div class="form-group">
                                <label>Poll Question</label>
                                <input type="text" name="question" value="${poll.question}" required>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>End Date</label>
                                    <input type="date" name="endDate" value="${poll.endDate}" required>
                                </div>
                                <div class="form-group">
                                    <label>Status</label>
                                    <select name="status">
                                        <option value="live" ${poll.status === 'live' ? 'selected' : ''}>Live</option>
                                        <option value="closed" ${poll.status === 'closed' ? 'selected' : ''}>Closed</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="form-section">
                            <h4>Poll Options</h4>
                            <div id="edit-poll-options-container">
                                ${poll.options.map((option, index) => `
                                    <div class="form-group">
                                        <input type="text" name="option${index + 1}" value="${option.text}" required>
                                        ${index >= 2 ? `<button type="button" class="remove-option-btn" onclick="this.parentElement.remove()" style="background: #dc0000; color: white; border: none; padding: 5px 10px; border-radius: 4px; margin-left: 10px; cursor: pointer;">×</button>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                            <button type="button" class="admin-btn" onclick="adminTools.addEditPollOption()" style="margin-top: 10px;">
                                + Add Option
                            </button>
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="save-btn">💾 Update Poll</button>
                            <button type="button" class="cancel-btn" onclick="adminTools.closeCircuitModal()">Cancel</button>
                            <button type="button" class="delete-btn" onclick="adminTools.resetPollVotes(${poll.id})">🔄 Reset Votes</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        document.getElementById('edit-poll-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updatePoll(new FormData(e.target));
        });
    }

    addEditPollOption() {
        const container = document.getElementById('edit-poll-options-container');
        const optionCount = container.children.length + 1;
        
        const optionHTML = `
            <div class="form-group">
                <input type="text" name="option${optionCount}" required placeholder="Option ${optionCount}">
                <button type="button" class="remove-option-btn" onclick="this.parentElement.remove()" style="background: #dc0000; color: white; border: none; padding: 5px 10px; border-radius: 4px; margin-left: 10px; cursor: pointer;">×</button>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', optionHTML);
    }

    updatePoll(formData) {
        const pollId = parseInt(formData.get('pollId'));
        const question = formData.get('question');
        const endDate = formData.get('endDate');
        const status = formData.get('status');
        
        const existingPolls = JSON.parse(localStorage.getItem('efc_polls') || '[]');
        const pollIndex = existingPolls.findIndex(p => p.id === pollId);
        
        if (pollIndex === -1) {
            this.showNotification('Poll not found', 'error');
            return;
        }
        
        // Collect options
        const options = [];
        let optionIndex = 1;
        while (formData.get(`option${optionIndex}`)) {
            const optionText = formData.get(`option${optionIndex}`);
            if (optionText.trim()) {
                // Preserve existing votes if option text matches, otherwise reset
                const existingOption = existingPolls[pollIndex].options.find(opt => opt.text === optionText.trim());
                options.push({
                    text: optionText.trim(),
                    votes: existingOption ? existingOption.votes : 0,
                    percentage: 0
                });
            }
            optionIndex++;
        }
        
        // Update poll
        existingPolls[pollIndex] = {
            ...existingPolls[pollIndex],
            question,
            options,
            status,
            endDate
        };
        
        // Recalculate percentages
        this.calculatePollPercentages(existingPolls[pollIndex]);
        
        localStorage.setItem('efc_polls', JSON.stringify(existingPolls));
        this.showNotification('Poll updated successfully!', 'success');
        this.closeCircuitModal();
        this.loadAdminPolls();
    }

    resetPollVotes(pollId) {
        if (!confirm('Are you sure you want to reset all votes for this poll? This cannot be undone.')) {
            return;
        }
        
        const existingPolls = JSON.parse(localStorage.getItem('efc_polls') || '[]');
        const pollIndex = existingPolls.findIndex(p => p.id === pollId);
        
        if (pollIndex === -1) {
            this.showNotification('Poll not found', 'error');
            return;
        }
        
        // Reset all votes
        existingPolls[pollIndex].options.forEach(option => {
            option.votes = 0;
            option.percentage = 0;
        });
        existingPolls[pollIndex].totalVotes = 0;
        
        // Clear user votes for this poll
        const userVotes = JSON.parse(localStorage.getItem('efc_poll_votes') || '{}');
        delete userVotes[pollId];
        localStorage.setItem('efc_poll_votes', JSON.stringify(userVotes));
        
        localStorage.setItem('efc_polls', JSON.stringify(existingPolls));
        this.showNotification('Poll votes reset successfully!', 'success');
        this.closeCircuitModal();
        this.loadAdminPolls();
    }

    deletePoll(pollId) {
        if (!confirm('Are you sure you want to delete this poll? This cannot be undone.')) {
            return;
        }
        
        const existingPolls = JSON.parse(localStorage.getItem('efc_polls') || '[]');
        const updatedPolls = existingPolls.filter(p => p.id !== pollId);
        
        // Clear user votes for this poll
        const userVotes = JSON.parse(localStorage.getItem('efc_poll_votes') || '{}');
        delete userVotes[pollId];
        localStorage.setItem('efc_poll_votes', JSON.stringify(userVotes));
        
        localStorage.setItem('efc_polls', JSON.stringify(updatedPolls));
        this.showNotification('Poll deleted successfully!', 'success');
        this.loadAdminPolls();
    }

    calculatePollPercentages(poll) {
        const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
        poll.totalVotes = totalVotes;
        
        poll.options.forEach(option => {
            option.percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
        });
    }

    updatePollStats() {
        const polls = JSON.parse(localStorage.getItem('efc_polls') || '[]');
        const totalPolls = polls.length;
        const livePolls = polls.filter(poll => poll.status === 'live').length;
        const totalVotes = polls.reduce((sum, poll) => sum + poll.totalVotes, 0);
        
        if (document.getElementById('total-polls')) {
            document.getElementById('total-polls').textContent = totalPolls;
        }
        if (document.getElementById('live-polls')) {
            document.getElementById('live-polls').textContent = livePolls;
        }
        if (document.getElementById('total-votes')) {
            document.getElementById('total-votes').textContent = totalVotes;
        }
    }
}

// Add this function to your admin panel
function exportDataForSheets() {
    // Get the ACTUAL data from your localStorage using the correct keys
    const exportData = [
        { Key: 'news', Data: localStorage.getItem('efcNews') || localStorage.getItem('efc_news') || '[]' },
        { Key: 'articles', Data: localStorage.getItem('efcArticles') || localStorage.getItem('efc_articles') || '[]' },
        { Key: 'polls', Data: localStorage.getItem('efcPolls') || localStorage.getItem('efc_polls') || '[]' },
        { Key: 'tracks', Data: localStorage.getItem('efcTracks') || localStorage.getItem('efc_tracks') || '[]' },
        { Key: 'trackInfo', Data: localStorage.getItem('efcTrackInfo') || localStorage.getItem('efc_track_info') || '[]' },
        { Key: 'circuitData', Data: localStorage.getItem('efcCircuitData') || localStorage.getItem('efc_circuit_data') || '[]' },
        { Key: 'circuitMaps', Data: localStorage.getItem('efcCircuitMaps') || localStorage.getItem('efc_circuit_maps') || '[]' },
        { Key: 'raceDates', Data: localStorage.getItem('efcRaceDates') || localStorage.getItem('efc_race_dates') || '[]' },
        { Key: 'lastUpdated', Data: new Date().toISOString() }
    ];
    
    let instructions = `📤 EFC Data Export - Copy to Google Sheets\n\n`;
    instructions += `1. Open your "WebsiteData" Google Sheet\n`;
    instructions += `2. Select ALL cells and DELETE everything\n`;
    instructions += `3. Paste this exact data:\n\n`;
    
    instructions += `Key\tData\n`;
    exportData.forEach(row => {
        // Clean the data for CSV (remove tabs and newlines)
        const cleanData = row.Data.replace(/\t/g, '    ').replace(/\n/g, ' ');
        instructions += `${row.Key}\t${cleanData}\n`;
    });
    
    instructions += `\n4. Save - all users will see changes immediately!`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(instructions).then(() => {
        alert('✅ Data copied! Your polls and circuit data will be available to all users.\n\nPaste into "WebsiteData" sheet.');
    }).catch(() => {
        // Fallback - show in prompt
        const instructionsText = `Copy everything below and paste into your WebsiteData sheet:\n\n${instructions}`;
        prompt('Copy this text:', instructionsText);
    });
}

// Add this to your admin panel HTML:
// <button onclick="exportDataForSheets()" class="admin-export-btn">📤 Export ALL Data to Google Sheets</button>


// Create global instance
window.adminTools = new AdminTools();