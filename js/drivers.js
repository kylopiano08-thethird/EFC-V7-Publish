// ===== DRIVERS PAGE FUNCTIONALITY =====
// Uses actual data from Google Sheets via data-loader.js

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const driversGrid = document.getElementById('driversGrid');
    const driverSearch = document.getElementById('driverSearch');
    const driverModalOverlay = document.getElementById('driverModalOverlay');
    const driverModal = document.getElementById('driverModal');
    const modalDriverName = document.getElementById('modalDriverName');
    const modalContent = document.getElementById('modalContent');
    const modalClose = document.getElementById('modalClose');
    
    // Global data cache
    let driversData = [];
    let driverStatsData = [];
    let teamsData = [];
    let raceResultsData = [];
    let qualifyingResultsData = [];
    
    // Team cache for quick lookups
    let teamCache = new Map();
    
    // Initialize the page
    initDriversPage();
    
    // Event Listeners
    driverSearch.addEventListener('input', filterDrivers);
    modalClose.addEventListener('click', closeModal);
    driverModalOverlay.addEventListener('click', function(e) {
        if (e.target === driverModalOverlay) {
            closeModal();
        }
    });
    
    // Initialize the drivers page
    async function initDriversPage() {
        showLoading();
        
        try {
            // Load data using the existing data loader
            const data = await efcDataLoader.loadHomepageData();
            
            // Extract the data we need
            driversData = data.driverMaster || [];
            driverStatsData = data.driverStats || [];
            teamsData = data.teamMaster || [];
            raceResultsData = data.raceResults || { results: [], headers: [] };
            qualifyingResultsData = data.qualifyingResults || { results: [], headers: [] };
            
            // Build team cache for quick lookups
            buildTeamCache();
            
            // Process and display drivers
            displayDrivers(driversData);
            
            // Start countdown timer AFTER data is loaded
            startCountdownTimer();
            
        } catch (error) {
            console.error('Error loading drivers data:', error);
            showError();
        }
    }
    
    // ===== COUNTDOWN TIMER - FIXED USING TEAMS PAGE CODE =====
    async function startCountdownTimer() {
        console.log('Starting countdown timer for drivers page...');
        
        try {
            // Load homepage data to get everything at once
            const data = await efcDataLoader.loadHomepageData();
            console.log('Homepage data loaded for drivers page:', data);
            
            const calendar = data.raceCalendar || [];
            const completedRaces = efcDataLoader.getCompletedRacesCount();
            
            console.log('Calendar data:', {
                totalRaces: calendar.length,
                completedRaces: completedRaces,
                races: calendar.map(r => ({ name: r.name, date: r.date, rawDate: r.date }))
            });
            
            // Clear any existing interval
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }
            
            // Get the timer display element
            const timerDisplay = document.getElementById('timer-display');
            if (!timerDisplay) {
                console.error('Timer display element not found');
                return;
            }
            
            if (calendar.length === 0) {
                timerDisplay.textContent = 'NO RACES';
                return;
            }
            
            // Find the next race
            let nextRace = null;
            
            if (completedRaces === 0) {
                // Season hasn't started - first race
                nextRace = calendar[0];
            } else if (completedRaces < calendar.length) {
                // Season in progress - next race
                nextRace = calendar[completedRaces];
            } else {
                // Season completed
                timerDisplay.textContent = 'SEASON COMPLETED';
                return;
            }
            
            if (!nextRace || !nextRace.date) {
                timerDisplay.textContent = 'DATE TBD';
                return;
            }
            
            console.log('Next race found:', {
                name: nextRace.name,
                rawDate: nextRace.date,
                formattedDate: efcDataLoader.formatDate(nextRace.date)
            });
            
            // Use the data loader's formatDate method
            const formattedDateStr = efcDataLoader.formatDate(nextRace.date);
            
            if (formattedDateStr === 'TBD' || formattedDateStr === 'Coming Soon') {
                timerDisplay.textContent = 'DATE TBD';
                return;
            }
            
            const targetDate = new Date(formattedDateStr);
            
            if (isNaN(targetDate.getTime())) {
                console.error('Invalid date:', formattedDateStr);
                timerDisplay.textContent = 'DATE TBD';
                return;
            }
            
            console.log('Target date:', targetDate);
            
            // Start the countdown
            const updateCountdownDisplay = () => {
                const now = new Date();
                const diff = targetDate - now;
                
                if (diff <= 0) {
                    timerDisplay.textContent = 'RACE DAY!';
                    clearInterval(window.countdownInterval);
                    return;
                }
                
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                
                const formattedHours = hours.toString().padStart(2, '0');
                const formattedMinutes = minutes.toString().padStart(2, '0');
                const formattedSeconds = seconds.toString().padStart(2, '0');
                
                const countdownStr = `${days}d ${formattedHours}h ${formattedMinutes}m ${formattedSeconds}s`;
                timerDisplay.textContent = countdownStr;
                
                console.log('Countdown update:', countdownStr);
            };
            
            // Update immediately
            updateCountdownDisplay();
            
            // Update every second
            window.countdownInterval = setInterval(updateCountdownDisplay, 1000);
            
        } catch (error) {
            console.error('Error in startCountdownTimer:', error);
            const timerDisplay = document.getElementById('timer-display');
            if (timerDisplay) {
                timerDisplay.textContent = 'ERROR';
            }
        }
    }
    
    // REST OF YOUR EXISTING CODE BELOW - NO CHANGES
    // Build team cache for quick lookups
    function buildTeamCache() {
        teamCache.clear();
        teamsData.forEach(team => {
            if (team.id) {
                teamCache.set(team.id, team);
            }
        });
    }
    
    // Get team info with proper full name - FIXED to use exact teamCode match
    function getTeamInfo(teamCode) {
        if (!teamCode) {
            return {
                id: '',
                name: 'No Team',
                fullName: 'No Team',
                primaryColor: '#666666',
                secondaryColor: '#999999',
                sponsor: '',
                logoUrl: ''
            };
        }
        
        // Try to find team by exact code first (case-insensitive)
        let team = teamsData.find(t => 
            t.id && t.id.toLowerCase() === teamCode.toLowerCase()
        );
        
        // If not found by exact code, try partial match
        if (!team) {
            team = teamsData.find(t => 
                t.id && teamCode.toLowerCase().includes(t.id.toLowerCase()) ||
                t.id && t.id.toLowerCase().includes(teamCode.toLowerCase())
            );
        }
        
        // If still not found, use the abbreviation mapping from data-loader
        if (!team) {
            const teamName = efcDataLoader.getTeamNameFromCode(teamCode);
            return {
                id: teamCode,
                name: teamName,
                fullName: teamName,
                primaryColor: '#666666',
                secondaryColor: '#999999',
                sponsor: '',
                logoUrl: ''
            };
        }
        
        // Use full name from TeamMaster (column A)
        return {
            id: team.id || teamCode,
            name: team.name || teamCode, // Column A - Full team name
            fullName: team.fullName || team.name || teamCode,
            primaryColor: team.primaryColor || '#00a8cc', // Column D
            secondaryColor: team.secondaryColor || '#cc3366', // Column E
            sponsor: team.sponsor || '',
            logoUrl: team.logoUrl || '',
            active: team.active || 'y'
        };
    }
    
    // Create gradient from team colors
    function createTeamGradient(primaryColor, secondaryColor) {
        return `linear-gradient(135deg, 
            rgba(10, 10, 25, 0.85) 0%, 
            rgba(20, 20, 40, 0.75) 100%),
            linear-gradient(135deg, ${primaryColor}20 0%, ${secondaryColor}15 100%)`;
    }
    
    // Create gradient for card header
    function createHeaderGradient(primaryColor, secondaryColor) {
        return `linear-gradient(135deg, 
            rgba(0, 0, 0, 0.5) 0%, 
            rgba(0, 0, 0, 0.3) 100%),
            linear-gradient(135deg, ${primaryColor}30 0%, ${secondaryColor}20 100%)`;
    }
    
    // Create background for elements
    function createElementBackground(primaryColor) {
        return `linear-gradient(135deg, 
            rgba(255, 255, 255, 0.08) 0%, 
            rgba(255, 255, 255, 0.04) 100%),
            linear-gradient(135deg, ${primaryColor}15 0%, transparent 100%)`;
    }
    
    // Create background for stats boxes
    function createStatsBackground(primaryColor) {
        return `linear-gradient(135deg, 
            rgba(0, 0, 0, 0.3) 0%, 
            rgba(0, 0, 0, 0.2) 100%),
            linear-gradient(135deg, ${primaryColor}20 0%, transparent 100%)`;
    }
    
    // Create BRIGHT text color from team color
    function createBrightColor(color) {
        return lightenColor(color, 30); // Much brighter than before
    }
    
    // Create VERY BRIGHT text color for numbers
    function createVeryBrightColor(color) {
        return lightenColor(color, 50); // Even brighter for numbers
    }
    
    // Create BRIGHT accent color for highlights
    function createAccentColor(color) {
        return lightenColor(color, 40); // Bright for accents
    }
    
    // Darken a color for better contrast
    function darkenColor(color, percent) {
        if (!color.startsWith('#')) return color;
        
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        
        return '#' + (
            0x1000000 +
            (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)
        ).toString(16).slice(1);
    }
    
    // Lighten a color
    function lightenColor(color, percent) {
        if (!color.startsWith('#')) return color;
        
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return '#' + (
            0x1000000 +
            (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)
        ).toString(16).slice(1);
    }
    
    // Display drivers in the grid
    function displayDrivers(drivers) {
        driversGrid.innerHTML = '';
        
        if (!drivers || drivers.length === 0) {
            showNoResults();
            return;
        }
        
        // Sort drivers by points from DriverStats
        const driversWithStats = drivers.map(driver => {
            const stats = driverStatsData.find(s => s.driver === driver.username);
            const teamInfo = getTeamInfo(driver.teamCode);
            
            return {
                ...driver,
                stats: stats || getEmptyStats(),
                points: stats?.points || 0,
                rating: stats?.driverRating || 0,
                teamInfo: teamInfo
            };
        });
        
        // Sort by points (descending)
        driversWithStats.sort((a, b) => b.points - a.points);
        
        // Create driver cards
        driversWithStats.forEach((driver, index) => {
            const position = index + 1;
            const driverCard = createDriverCard(driver, position);
            driversGrid.appendChild(driverCard);
        });
    }
    
    // Create a driver card element
    function createDriverCard(driver, position) {
        const card = document.createElement('div');
        card.className = 'driver-card';
        card.dataset.driverId = driver.username;
        
        // Get team info
        const teamInfo = driver.teamInfo;
        const teamColor = teamInfo.primaryColor;
        const secondaryColor = teamInfo.secondaryColor;
        
        // Create gradients
        const cardGradient = createTeamGradient(teamColor, secondaryColor);
        const headerGradient = createHeaderGradient(teamColor, secondaryColor);
        const statsBackground = createStatsBackground(teamColor);
        const elementBackground = createElementBackground(teamColor);
        
        // Create BRIGHT color variations
        const darkTeamColor = darkenColor(teamColor, 15);
        const brightTeamColor = createBrightColor(teamColor); // 30% brighter
        const veryBrightTeamColor = createVeryBrightColor(teamColor); // 50% brighter for numbers
        const accentTeamColor = createAccentColor(teamColor); // 40% brighter for accents
        
        // Get driver value - ASSUME IT'S IN MILLIONS
        const driverValue = driver.value || driver.Value || 'N/A';
        const formattedValue = formatValue(driverValue);
        
        // Apply team gradient to card background
        card.style.background = cardGradient;
        card.style.borderColor = `${teamColor}60`;
        
        // Create card HTML with BRIGHT numbers
        card.innerHTML = `
            <div class="driver-card-header" style="background: ${headerGradient}; border-bottom-color: ${teamColor}50;">
                <div class="driver-avatar-container" style="border-color: ${accentTeamColor}; background: linear-gradient(135deg, ${teamColor}30 0%, ${secondaryColor}20 100%);">
                    ${driver.photo ? 
                        `<img src="${driver.photo}" alt="${driver.username}" class="driver-avatar">` : 
                        `<div class="driver-avatar-placeholder" style="color: ${accentTeamColor};">
                            <i class="fas fa-user"></i>
                        </div>`
                    }
                </div>
                
                <div class="driver-header-main">
                    <div class="driver-name">${driver.username}</div>
                    <div class="driver-team" style="color: ${brightTeamColor}">${teamInfo.name}</div>
                    
                    <!-- Points badge with team gradient and BRIGHT text -->
                    <div class="driver-points-badge" style="background: linear-gradient(135deg, ${darkTeamColor} 0%, ${darkenColor(secondaryColor, 15)} 100%); border-color: ${accentTeamColor}; color: white; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">
                        <i class="fas fa-trophy" style="color: gold; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);"></i>
                        <span style="font-weight: 900; letter-spacing: 1px;">${driver.points} pts</span>
                    </div>
                    
                    <!-- Value badge with BRIGHT text - ADDED "M" -->
                    <div class="driver-value-badge" style="background: linear-gradient(135deg, #ffaa00 0%, #cc8800 100%); border-color: #ffcc00; color: white; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">
                        <i class="fas fa-dollar-sign" style="color: #ffff00;"></i>
                        <span style="font-weight: 900; letter-spacing: 1px;">${formattedValue}</span>
                    </div>
                </div>
            </div>
            
            <div class="driver-card-content">
                <div class="driver-info-container">
                    <div class="driver-info-left">
                        <div class="driver-number" style="color: ${veryBrightTeamColor}; text-shadow: 0 2px 10px ${teamColor}80; font-weight: 900;">#${driver.number || '??'}</div>
                        <div class="driver-nationality">
                            ${driver.nationality || 'N/A'}
                        </div>
                        <div class="driver-rating" style="color: #ffdd00; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">
                            <i class="fas fa-star" style="color: gold; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);"></i> 
                            <span style="font-weight: 700;">${driver.rating.toFixed(1)}</span>
                        </div>
                    </div>
                    
                    <div class="driver-info-right">
                        <div class="driver-stats-mini">
                            <div class="driver-stat-mini" style="background: ${statsBackground}; border-color: ${teamColor}40;">
                                <div class="driver-stat-label">Wins</div>
                                <div class="driver-stat-value" style="color: ${veryBrightTeamColor}; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); font-weight: 900; font-size: 1.6rem;">${driver.stats.wins || 0}</div>
                            </div>
                            <div class="driver-stat-mini" style="background: ${statsBackground}; border-color: ${teamColor}40;">
                                <div class="driver-stat-label">Podiums</div>
                                <div class="driver-stat-value" style="color: ${veryBrightTeamColor}; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); font-weight: 900; font-size: 1.6rem;">${driver.stats.podiums || 0}</div>
                            </div>
                            <div class="driver-stat-mini" style="background: ${statsBackground}; border-color: ${teamColor}40;">
                                <div class="driver-stat-label">Poles</div>
                                <div class="driver-stat-value" style="color: ${veryBrightTeamColor}; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); font-weight: 900; font-size: 1.6rem;">${driver.stats.poles || 0}</div>
                            </div>
                            <div class="driver-stat-mini" style="background: ${statsBackground}; border-color: ${teamColor}40;">
                                <div class="driver-stat-label">Races</div>
                                <div class="driver-stat-value" style="color: ${veryBrightTeamColor}; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); font-weight: 900; font-size: 1.6rem;">${driver.stats.racesAttended || 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add hover effect with enhanced gradient
        card.addEventListener('mouseenter', () => {
            card.style.background = `linear-gradient(135deg, 
                rgba(10, 10, 25, 0.8) 0%, 
                rgba(20, 20, 40, 0.7) 100%),
                linear-gradient(135deg, ${teamColor}30 0%, ${secondaryColor}25 100%)`;
            card.style.borderColor = `${accentTeamColor}`;
            card.style.boxShadow = `0 15px 30px rgba(0, 0, 0, 0.4), 0 0 25px ${teamColor}40`;
            card.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.background = cardGradient;
            card.style.borderColor = `${teamColor}60`;
            card.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.2)';
            card.style.transform = 'translateY(0)';
        });
        
        // Add click event to show modal
        card.addEventListener('click', () => showDriverModal(driver.username));
        
        return card;
    }
    
    // Format driver value - ASSUME IT'S IN MILLIONS, JUST ADD "M"
    function formatValue(value) {
        if (value === 'N/A' || !value || value.trim() === '') return 'N/A';
        
        // Clean the value
        value = value.toString().trim();
        
        // Remove currency symbols if present
        value = value.replace(/[$,£€]/g, '');
        
        // Try to parse as number
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return value;
        
        // ALWAYS show as millions with "M" suffix
        // Since the value is already in millions, just add "M"
        return `$${numValue.toFixed(1)}M`;
    }
    
    // Filter drivers based on search input
    function filterDrivers() {
        const searchTerm = driverSearch.value.toLowerCase().trim();
        
        if (!searchTerm) {
            displayDrivers(driversData);
            return;
        }
        
        const filteredDrivers = driversData.filter(driver => {
            const teamInfo = getTeamInfo(driver.teamCode);
            
            return (
                driver.username.toLowerCase().includes(searchTerm) ||
                (driver.nationality && driver.nationality.toLowerCase().includes(searchTerm)) ||
                (teamInfo.name && teamInfo.name.toLowerCase().includes(searchTerm)) ||
                (driver.teamCode && driver.teamCode.toLowerCase().includes(searchTerm)) ||
                (driver.value && driver.value.toString().toLowerCase().includes(searchTerm))
            );
        });
        
        displayDrivers(filteredDrivers);
    }
    
    // Show driver details in modal
    async function showDriverModal(driverUsername) {
        // Find driver data
        const driver = driversData.find(d => d.username === driverUsername);
        if (!driver) return;
        
        // Find driver stats
        const stats = driverStatsData.find(s => s.driver === driverUsername) || getEmptyStats();
        
        // Get team info
        const teamInfo = getTeamInfo(driver.teamCode);
        
        // Create gradients for modal
        const cardGradient = createTeamGradient(teamInfo.primaryColor, teamInfo.secondaryColor);
        const headerGradient = createHeaderGradient(teamInfo.primaryColor, teamInfo.secondaryColor);
        const statsBackground = createStatsBackground(teamInfo.primaryColor);
        const elementBackground = createElementBackground(teamInfo.primaryColor);
        
        // Create BRIGHT color variations
        const darkTeamColor = darkenColor(teamInfo.primaryColor, 15);
        const brightTeamColor = createBrightColor(teamInfo.primaryColor);
        const veryBrightTeamColor = createVeryBrightColor(teamInfo.primaryColor);
        const accentTeamColor = createAccentColor(teamInfo.primaryColor);
        
        // Calculate consistency color
        const consistencyColor = getConsistencyColor(stats.consistencyScore);
        
        // Get driver value - ASSUME IT'S IN MILLIONS
        const driverValue = driver.value || driver.Value || 'N/A';
        const formattedValue = formatValue(driverValue);
        
        // Get teammate (if any)
        const teammates = driversData.filter(d => 
            d.teamCode === driver.teamCode && d.username !== driver.username
        );
        
        // Parse socials/onboards from column K
        const socialsContent = parseSocials(driver.socials);
        
        // Get team personnel from Owners and Engineers sheet
        let teamPersonnel = [];
        try {
            const personnelData = await efcDataLoader.fetchCSV('Owners and Engineers');
            if (personnelData) {
                teamPersonnel = processPersonnelData(personnelData, teamInfo.name);
            }
        } catch (error) {
            console.error('Error loading personnel data:', error);
        }
        
        // Set modal title
        modalDriverName.textContent = driver.username;
        
        // Create modal content with BRIGHT numbers
        modalContent.innerHTML = `
            <div class="modal-layout">
                <div class="modal-sidebar">
                    <div class="modal-avatar-container" style="border-color: ${accentTeamColor}; background: linear-gradient(135deg, ${teamInfo.primaryColor}30 0%, ${teamInfo.secondaryColor}20 100%);">
                        ${driver.photo ? 
                            `<img src="${driver.photo}" alt="${driver.username}" class="modal-avatar">` : 
                            `<div class="driver-avatar-placeholder" style="font-size: 5rem; color: ${accentTeamColor};">
                                <i class="fas fa-user"></i>
                            </div>`
                        }
                    </div>
                    
                    <div class="modal-info-card" style="background: ${cardGradient}; border-color: ${teamInfo.primaryColor}50;">
                        <div class="info-item">
                            <span class="info-label">Driver #</span>
                            <span class="info-value" style="color: white; font-weight: 700;">${driver.number || '??'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Nationality</span>
                            <span class="info-value" style="color: white; font-weight: 600;">${driver.nationality || 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Team</span>
                            <span class="info-value team" style="color: ${brightTeamColor}; font-weight: 700;">
                                ${teamInfo.name}
                            </span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Rating</span>
                            <span class="info-value rating" style="color: #ffdd00; font-weight: 700;">
                                <i class="fas fa-star" style="color: gold;"></i> ${stats.driverRating?.toFixed(1) || 'N/A'}
                            </span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Position</span>
                            <span class="info-value" style="color: white; font-weight: 700;">${getDriverPosition(driver.username)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Value</span>
                            <span class="info-value" style="color: #ffcc00; font-weight: 700;">
                                <i class="fas fa-dollar-sign"></i> ${formattedValue}
                            </span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Status</span>
                            <span class="info-value" style="color: ${driver.active === 'y' ? '#00ff00' : '#ff6666'}; font-weight: 700;">
                                ${driver.active === 'y' ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        ${driver.discord ? `
                        <div class="info-item">
                            <span class="info-label">Discord</span>
                            <span class="info-value" style="color: #8ea1e1; font-weight: 600;">
                                <i class="fab fa-discord"></i> ${driver.discord}
                            </span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="modal-main">
                    <div class="modal-stats-grid">
                        <div class="modal-stat-item" style="background: ${statsBackground}; border-color: ${accentTeamColor};">
                            <div class="modal-stat-label">Points</div>
                            <div class="modal-stat-value" style="color: ${veryBrightTeamColor}; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); font-weight: 900; font-size: 2.2rem;">${stats.points || 0}</div>
                        </div>
                        <div class="modal-stat-item" style="background: ${statsBackground}; border-color: ${accentTeamColor};">
                            <div class="modal-stat-label">Wins</div>
                            <div class="modal-stat-value" style="color: ${veryBrightTeamColor}; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); font-weight: 900; font-size: 2.2rem;">${stats.wins || 0}</div>
                        </div>
                        <div class="modal-stat-item" style="background: ${statsBackground}; border-color: ${accentTeamColor};">
                            <div class="modal-stat-label">Podiums</div>
                            <div class="modal-stat-value" style="color: ${veryBrightTeamColor}; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); font-weight: 900; font-size: 2.2rem;">${stats.podiums || 0}</div>
                        </div>
                        <div class="modal-stat-item" style="background: ${statsBackground}; border-color: ${accentTeamColor};">
                            <div class="modal-stat-label">Poles</div>
                            <div class="modal-stat-value" style="color: ${veryBrightTeamColor}; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5); font-weight: 900; font-size: 2.2rem;">${stats.poles || 0}</div>
                        </div>
                    </div>
                    
                    <div class="performance-section" style="background: ${cardGradient}; border-color: ${teamInfo.primaryColor}50;">
                        <h3 class="performance-title" style="border-bottom-color: ${accentTeamColor}; color: ${brightTeamColor};">
                            <i class="fas fa-chart-line" style="color: ${brightTeamColor}"></i> Performance Metrics
                        </h3>
                        <div class="performance-grid">
                            <div class="performance-item" style="background: ${elementBackground}; border-color: ${teamInfo.primaryColor}40;">
                                <div class="performance-label">Avg Finish</div>
                                <div class="performance-value" style="color: white; font-weight: 900; font-size: 2rem; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">${stats.avgFinish?.toFixed(1) || 'N/A'}</div>
                            </div>
                            <div class="performance-item" style="background: ${elementBackground}; border-color: ${teamInfo.primaryColor}40;">
                                <div class="performance-label">Avg Quali</div>
                                <div class="performance-value" style="color: white; font-weight: 900; font-size: 2rem; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">${stats.avgQuali?.toFixed(1) || 'N/A'}</div>
                            </div>
                            <div class="performance-item" style="background: ${elementBackground}; border-color: ${teamInfo.primaryColor}40;">
                                <div class="performance-label">Consistency</div>
                                <div class="performance-value" style="color: ${consistencyColor}; font-weight: 900; font-size: 2rem; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">
                                    ${stats.consistencyScore?.toFixed(1) || 'N/A'}
                                </div>
                            </div>
                            <div class="performance-item" style="background: ${elementBackground}; border-color: ${teamInfo.primaryColor}40;">
                                <div class="performance-label">Fastest Laps</div>
                                <div class="performance-value" style="color: white; font-weight: 900; font-size: 2rem; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">${stats.fastestLaps || 0}</div>
                            </div>
                            <div class="performance-item" style="background: ${elementBackground}; border-color: ${teamInfo.primaryColor}40;">
                                <div class="performance-label">DNFs</div>
                                <div class="performance-value" style="color: white; font-weight: 900; font-size: 2rem; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">${stats.dnfs || 0}</div>
                            </div>
                            <div class="performance-item" style="background: ${elementBackground}; border-color: ${teamInfo.primaryColor}40;">
                                <div class="performance-label">Podium Rate</div>
                                <div class="performance-value" style="color: white; font-weight: 900; font-size: 2rem; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);">${stats.podiumRate ? stats.podiumRate.toFixed(1) + '%' : 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    
                    ${socialsContent ? `
                    <div class="performance-section" style="background: ${cardGradient}; border-color: ${teamInfo.primaryColor}50;">
                        <h3 class="performance-title" style="border-bottom-color: ${accentTeamColor}; color: ${brightTeamColor};">
                            <i class="fas fa-link" style="color: ${brightTeamColor}"></i> Onboards & Socials
                        </h3>
                        <div class="socials-content">
                            ${socialsContent}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${driver.description ? `
                    <div class="driver-description-box" style="background: ${cardGradient}; border-color: ${teamInfo.primaryColor}50;">
                        <h4 style="color: ${brightTeamColor}">About ${driver.username}</h4>
                        <p style="color: rgba(255, 255, 255, 0.9);">${driver.description}</p>
                    </div>
                    ` : ''}
                    
                    ${teammates.length > 0 ? `
                    <div class="performance-section" style="background: ${cardGradient}; border-color: ${teamInfo.primaryColor}50;">
                        <h3 class="performance-title" style="border-bottom-color: ${accentTeamColor}; color: ${brightTeamColor};">
                            <i class="fas fa-users" style="color: ${brightTeamColor}"></i> Teammates
                        </h3>
                        <div class="drivers-grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
                            ${teammates.map(teammate => {
                                const teammateStats = driverStatsData.find(s => s.driver === teammate.username) || getEmptyStats();
                                const teammateValue = teammate.value || teammate.Value || 'N/A';
                                const teammateFormattedValue = formatValue(teammateValue);
                                
                                const teammateTeamInfo = getTeamInfo(teammate.teamCode);
                                const teammateGradient = createTeamGradient(teammateTeamInfo.primaryColor, teammateTeamInfo.secondaryColor);
                                const teammateBrightColor = createBrightColor(teammateTeamInfo.primaryColor);
                                const teammateVeryBrightColor = createVeryBrightColor(teammateTeamInfo.primaryColor);
                                const teammateAccentColor = createAccentColor(teammateTeamInfo.primaryColor);
                                
                                return `
                                <div class="driver-card" style="cursor: pointer; height: auto; min-height: 120px; background: ${teammateGradient}; border-color: ${teammateAccentColor};" onclick="document.querySelector('.driver-card[data-driver-id=\"${teammate.username}\"]')?.click()">
                                    <div style="display: flex; align-items: center; gap: 1rem;">
                                        <div class="driver-icon" style="width: 50px; height: 50px; background: linear-gradient(135deg, ${teammateTeamInfo.primaryColor}30 0%, ${teammateTeamInfo.secondaryColor}20 100%); border: 2px solid ${teammateAccentColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                            ${teammate.photo ? 
                                                `<img src="${teammate.photo}" alt="${teammate.username}" style="width: 100%; height: 100%; border-radius: 50%;">` :
                                                `<i class="fas fa-user" style="color: ${teammateVeryBrightColor}; font-size: 1.5rem;"></i>`
                                            }
                                        </div>
                                        <div>
                                            <div class="driver-name" style="font-size: 1.1rem; color: white; font-weight: 600;">${teammate.username}</div>
                                            <div class="driver-role" style="color: ${teammateBrightColor}; font-weight: 600;">Teammate</div>
                                            <div style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.8); font-weight: 600;">
                                                Points: <span style="color: ${teammateVeryBrightColor}">${teammateStats.points || 0}</span> | 
                                                Value: <span style="color: #ffcc00">${teammateFormattedValue}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Update modal background with team gradient
        driverModal.style.background = `linear-gradient(135deg, rgba(15, 15, 30, 0.95) 0%, rgba(25, 25, 45, 0.9) 100%), 
            linear-gradient(135deg, ${teamInfo.primaryColor}15 0%, ${teamInfo.secondaryColor}10 100%)`;
        driverModal.style.borderColor = `${accentTeamColor}`;
        
        // Update modal header with gradient
        const modalHeader = driverModal.querySelector('.driver-modal-header');
        if (modalHeader) {
            modalHeader.style.background = `linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, transparent 100%), 
                linear-gradient(135deg, ${teamInfo.primaryColor}40 0%, ${teamInfo.secondaryColor}30 100%)`;
            modalHeader.style.borderBottomColor = `${accentTeamColor}`;
        }
        
        // Show the modal
        driverModalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // Parse socials/onboards from column K
    function parseSocials(socialsText) {
        if (!socialsText || socialsText.trim() === '') return '';
        
        const socials = socialsText.split(',').map(s => s.trim());
        let html = '<div style="display: flex; flex-wrap: wrap; gap: 1rem;">';
        
        socials.forEach(social => {
            if (!social) return;
            
            // Check for common social media patterns
            if (social.includes('youtube.com') || social.includes('youtu.be')) {
                html += `
                    <a href="${social}" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(255, 0, 0, 0.2); border: 1px solid rgba(255, 0, 0, 0.4); border-radius: 8px; color: white; text-decoration: none; transition: all 0.3s ease; font-weight: 600;">
                        <i class="fab fa-youtube" style="color: #ff3333;"></i>
                        <span>YouTube</span>
                    </a>
                `;
            } else if (social.includes('twitch.tv')) {
                html += `
                    <a href="${social}" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(155, 106, 255, 0.2); border: 1px solid rgba(155, 106, 255, 0.4); border-radius: 8px; color: white; text-decoration: none; transition: all 0.3s ease; font-weight: 600;">
                        <i class="fab fa-twitch" style="color: #9b6aff;"></i>
                        <span>Twitch</span>
                    </a>
                `;
            } else if (social.includes('twitter.com') || social.includes('x.com')) {
                html += `
                    <a href="${social}" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(29, 161, 242, 0.2); border: 1px solid rgba(29, 161, 242, 0.4); border-radius: 8px; color: white; text-decoration: none; transition: all 0.3s ease; font-weight: 600;">
                        <i class="fab fa-twitter" style="color: #1da1f2;"></i>
                        <span>Twitter</span>
                    </a>
                `;
            } else if (social.includes('instagram.com')) {
                html += `
                    <a href="${social}" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(228, 64, 95, 0.2); border: 1px solid rgba(228, 64, 95, 0.4); border-radius: 8px; color: white; text-decoration: none; transition: all 0.3s ease; font-weight: 600;">
                        <i class="fab fa-instagram" style="color: #e4405f;"></i>
                        <span>Instagram</span>
                    </a>
                `;
            } else if (social.includes('tiktok.com')) {
                html += `
                    <a href="${social}" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(0, 0, 0, 0.4); border-radius: 8px; color: white; text-decoration: none; transition: all 0.3s ease; font-weight: 600;">
                        <i class="fab fa-tiktok" style="color: #ffffff;"></i>
                        <span>TikTok</span>
                    </a>
                `;
            } else if (social.includes('discord.gg') || social.includes('discord.com')) {
                html += `
                    <a href="${social}" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(114, 137, 218, 0.2); border: 1px solid rgba(114, 137, 218, 0.4); border-radius: 8px; color: white; text-decoration: none; transition: all 0.3s ease; font-weight: 600;">
                        <i class="fab fa-discord" style="color: #7289da;"></i>
                        <span>Discord</span>
                    </a>
                `;
            } else if (social.includes('steamcommunity.com')) {
                html += `
                    <a href="${social}" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0, 173, 238, 0.2); border: 1px solid rgba(0, 173, 238, 0.4); border-radius: 8px; color: white; text-decoration: none; transition: all 0.3s ease; font-weight: 600;">
                        <i class="fab fa-steam" style="color: #00adee;"></i>
                        <span>Steam</span>
                    </a>
                `;
            } else {
                // Generic link with subtle color
                html += `
                    <a href="${social}" target="_blank" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 8px; color: white; text-decoration: none; transition: all 0.3s ease; font-weight: 600;">
                        <i class="fas fa-link"></i>
                        <span>Link</span>
                    </a>
                `;
            }
        });
        
        html += '</div>';
        return html;
    }
    
    // Close modal
    function closeModal() {
        driverModalOverlay.classList.remove('active');
        document.body.style.overflow = 'auto';
        
        // Reset modal styles
        driverModal.style.background = '';
        driverModal.style.borderColor = '';
    }
    
    // Get driver position in championship
    function getDriverPosition(driverUsername) {
        const driversWithStats = driversData.map(driver => {
            const stats = driverStatsData.find(s => s.driver === driver.username);
            return {
                username: driver.username,
                points: stats?.points || 0
            };
        });
        
        // Sort by points (descending)
        driversWithStats.sort((a, b) => b.points - a.points);
        
        const position = driversWithStats.findIndex(d => d.username === driverUsername);
        return position !== -1 ? position + 1 : 'N/A';
    }
    
    // Get consistency color based on score (0-10)
    function getConsistencyColor(score) {
        if (!score) return '#cccccc';
        
        if (score >= 9) return '#00ff00'; // Bright green
        if (score >= 8) return '#aaff00'; // Bright yellow-green
        if (score >= 7) return '#ffff00'; // Bright yellow
        if (score >= 6) return '#ffaa00'; // Bright orange
        return '#ff6666'; // Bright red
    }
    
    // Process personnel data from CSV
    function processPersonnelData(csvText, teamName) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const personnel = [];
        const headers = efcDataLoader.parseCSVLine(lines[0]);
        
        for (let i = 1; i < lines.length; i++) {
            const values = efcDataLoader.parseCSVLine(lines[i]);
            if (values.length < 2) continue;
            
            // Check if this personnel belongs to the specified team
            const personTeam = values[2] || '';
            if (!teamName || !personTeam || personTeam.toLowerCase().includes(teamName.toLowerCase())) {
                personnel.push({
                    name: values[0] || '',
                    role: values[1] || '',
                    team: values[2] || '',
                    discord: values[3] || '',
                    picture: values[4] || '',
                    description: values[5] || ''
                });
            }
        }
        
        return personnel;
    }
    
    // Get empty stats object
    function getEmptyStats() {
        return {
            racesAttended: 0,
            points: 0,
            ptsPerRace: 0,
            avgFinish: 0,
            avgQuali: 0,
            wins: 0,
            podiums: 0,
            poles: 0,
            driverRating: 0,
            consistencyScore: 0,
            performanceScore: 0,
            fastestLaps: 0,
            highestFinish: '',
            avgPosGainLoss: 0,
            podiumRate: 0,
            dnfs: 0,
            championships: 0
        };
    }
    
    // Show loading state
    function showLoading() {
        driversGrid.innerHTML = `
            <div class="drivers-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading drivers data...</p>
            </div>
        `;
    }
    
    // Show error state
    function showError() {
        driversGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading drivers data. Please try again later.</p>
                <button onclick="initDriversPage()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--secondary); border: none; border-radius: 5px; color: white; cursor: pointer;">
                    Retry
                </button>
            </div>
        `;
    }
    
    // Show no results state
    function showNoResults() {
        driversGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No drivers found matching your search.</p>
            </div>
        `;
    }
});