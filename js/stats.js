
/**
 * EFC Statistics Page - Displays driver and team statistics
 */

class EFCStatsPage {
    constructor() {
        this.dataLoader = efcDataLoader;
        this.currentDriverSort = 'points';
        this.currentTeamSort = 'points';
        this.driverSortDirection = 'desc';
        this.teamSortDirection = 'desc';
        this.filteredDriverStats = [];
        this.filteredTeamStats = [];
        this.currentSearchTerm = '';
        this.initialized = false;
        this.countdownInterval = null; // Added: Countdown timer interval
        
        this.init();
    }

    async init() {
        // Initialize event listeners
        this.setupEventListeners();
        
        // Load and display data
        await this.loadAndDisplayData();
        
        // Start next race countdown timer
        this.startNextRaceCountdown();
        
        this.initialized = true;
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Dropdown sorting
        const sortSelect = document.getElementById('sortSelect');
        sortSelect.addEventListener('change', (e) => {
            const sortType = e.target.value;
            this.changeSort(sortType);
        });

        // Table header sorting (still works too)
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => {
                const sortKey = e.currentTarget.dataset.sort;
                this.sortTable(sortKey);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.currentSearchTerm = e.target.value.toLowerCase();
            this.filterAndDisplayData();
        });
        
        // Add refresh button
        this.addRefreshButton();
    }

    async loadAndDisplayData() {
        try {
            // Hide empty state, show loading
            document.getElementById('loading-state').style.display = 'block';
            document.getElementById('empty-state').style.display = 'none';

            // Load data from data loader
            const data = await this.dataLoader.loadHomepageData();
            
            if (!data || !data.driverStats || data.driverStats.length === 0) {
                this.showEmptyState();
                return;
            }

            // Store data
            this.driverStats = data.driverStats;
            this.teamStats = this.generateTeamStats(data);
            this.driverMaster = data.driverMaster;
            this.teamMaster = data.teamMaster;
            
            // Filter data (initially no filter)
            this.filteredDriverStats = [...this.driverStats];
            this.filteredTeamStats = [...this.teamStats];
            
            // Display data
            this.displayDriverStats();
            this.displayTeamStats();
            
            // Hide loading state
            document.getElementById('loading-state').style.display = 'none';
            
            // Update championship stats
            this.updateChampionshipStats();
            
        } catch (error) {
            console.error('Error loading stats data:', error);
            this.showEmptyState();
        }
    }

    generateTeamStats(data) {
        // Create team stats from driver stats and team master
        const teams = {};
        
        // Initialize teams from team master
        data.teamMaster.forEach(team => {
            if (team.active === 'y' && team.id) {
                teams[team.id] = {
                    team: team.name,
                    teamCode: team.id,
                    points: 0,
                    podiums: 0,
                    wins: 0,
                    teamRating: 0,
                    fastestLaps: 0,
                    poles: 0,
                    dnfs: 0,
                    pointsPerRace: 0,
                    podiumRate: 0,
                    championships: 0,
                    driverCount: 0,
                    primaryColor: team.primaryColor || '#00f7ff',
                    secondaryColor: team.secondaryColor || '#ffffff',
                    carImageUrl: team.carImageUrl || ''
                };
            }
        });

        // Aggregate driver stats to team stats
        data.driverStats.forEach(driverStat => {
            // Find driver's team
            const driverInfo = data.driverMaster.find(d => d.username === driverStat.driver);
            if (!driverInfo || !driverInfo.teamCode) return;
            
            const teamCode = driverInfo.teamCode;
            if (!teams[teamCode]) return;
            
            // Add driver's stats to team
            const team = teams[teamCode];
            team.points += driverStat.points || 0;
            team.podiums += driverStat.podiums || 0;
            team.wins += driverStat.wins || 0;
            team.fastestLaps += driverStat.fastestLaps || 0;
            team.dnfs += driverStat.dnfs || 0;
            team.driverCount += 1;
            
            // Add poles (need to get from qualifying results - simplified)
            team.poles += driverStat.poles || 0;
            
            // Calculate team rating as average of driver ratings
            team.teamRating += driverStat.driverRating || 0;
        });

        // Calculate averages
        Object.values(teams).forEach(team => {
            if (team.driverCount > 0) {
                team.teamRating = parseFloat((team.teamRating / team.driverCount).toFixed(1));
                const avgRaces = data.driverStats[0]?.racesAttended || 1;
                team.pointsPerRace = parseFloat((team.points / avgRaces).toFixed(1));
                team.podiumRate = team.podiums > 0 ? 
                    parseFloat(((team.podiums / avgRaces) * 100).toFixed(1)) : 0;
            }
        });

        // Convert to array and sort by points
        return Object.values(teams).sort((a, b) => b.points - a.points);
    }

    displayDriverStats() {
        const tableBody = document.getElementById('driver-stats-body');
        
        if (!this.filteredDriverStats || this.filteredDriverStats.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="19" style="text-align: center; padding: 40px;">No driver statistics available</td></tr>';
            return;
        }

        let html = '';
        
        // Sort driver stats
        const sortedStats = this.sortDriverStats(this.filteredDriverStats, this.currentDriverSort, this.driverSortDirection);
        
        sortedStats.forEach((stat, index) => {
            const driverInfo = this.driverMaster?.find(d => d.username === stat.driver) || {};
            const teamName = this.getTeamName(driverInfo.teamCode);
            
            // Determine value styling classes
            const pointsClass = stat.points ? 'points-value' : '';
            const ratingClass = stat.driverRating ? 'rating-value' : '';
            const winsClass = stat.wins ? 'wins-value' : '';
            const podiumsClass = stat.podiums ? 'podiums-value' : '';
            const polesClass = stat.poles ? 'poles-value' : '';
            const dnfsClass = stat.dnfs ? 'dnfs-value' : '';
            
            html += `
                <tr class="position-${index + 1}">
                    <td>${index + 1}</td>
                    <td style="text-align: left;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${driverInfo.photo ? `<img src="${driverInfo.photo}" alt="${stat.driver}" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover;">` : '<div style="width: 35px; height: 35px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-weight: bold;">' + (driverInfo.number || '?') + '</div>'}
                            <div>
                                <div style="font-weight: 600;">${stat.driver}</div>
                                <div style="font-size: 12px; color: rgba(255,255,255,0.6);">${driverInfo.nationality || ''}</div>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: left;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${this.getTeamColor(driverInfo.teamCode)};"></div>
                            <span>${teamName}</span>
                        </div>
                    </td>
                    <td>${stat.racesAttended || 0}</td>
                    <td class="${pointsClass}">${stat.points || 0}</td>
                    <td>${stat.ptsPerRace ? stat.ptsPerRace.toFixed(1) : '0.0'}</td>
                    <td>${stat.avgFinish ? stat.avgFinish.toFixed(1) : '0.0'}</td>
                    <td>${stat.avgQuali ? stat.avgQuali.toFixed(1) : '0.0'}</td>
                    <td class="${winsClass}">${stat.wins || 0}</td>
                    <td class="${podiumsClass}">${stat.podiums || 0}</td>
                    <td class="${polesClass}">${stat.poles || 0}</td>
                    <td class="${ratingClass}">${stat.driverRating ? stat.driverRating.toFixed(1) : '0.0'}</td>
                    <td>${stat.consistencyScore ? stat.consistencyScore.toFixed(1) : '0.0'}</td>
                    <td>${stat.fastestLaps || 0}</td>
                    <td>${stat.highestFinish || 'N/A'}</td>
                    <td>${stat.avgPosGainLoss ? stat.avgPosGainLoss.toFixed(1) : '0.0'}</td>
                    <td>${stat.podiumRate ? stat.podiumRate.toFixed(1) + '%' : '0%'}</td>
                    <td class="${dnfsClass}">${stat.dnfs || 0}</td>
                    <td>${stat.championships || 0}</td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Update sort indicators in table headers
        this.updateSortIndicators('driver');
        
        // Update dropdown selection
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = this.currentDriverSort;
        }
    }

    displayTeamStats() {
        const tableBody = document.getElementById('team-stats-body');
        
        if (!this.filteredTeamStats || this.filteredTeamStats.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 40px;">No team statistics available</td></tr>';
            return;
        }

        let html = '';
        
        // Sort team stats
        const sortedStats = this.sortTeamStats(this.filteredTeamStats, this.currentTeamSort, this.teamSortDirection);
        
        sortedStats.forEach((stat, index) => {
            // Determine value styling classes
            const pointsClass = stat.points ? 'points-value' : '';
            const ratingClass = stat.teamRating ? 'rating-value' : '';
            const winsClass = stat.wins ? 'wins-value' : '';
            const podiumsClass = stat.podiums ? 'podiums-value' : '';
            const polesClass = stat.poles ? 'poles-value' : '';
            const dnfsClass = stat.dnfs ? 'dnfs-value' : '';
            
            html += `
                <tr class="position-${index + 1}">
                    <td>${index + 1}</td>
                    <td style="text-align: left;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            ${stat.carImageUrl ? `<img src="${stat.carImageUrl}" alt="${stat.team}" style="width: 40px; height: 20px; object-fit: contain;">` : ''}
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${stat.primaryColor};"></div>
                                <span style="font-weight: 600;">${stat.team}</span>
                            </div>
                        </div>
                    </td>
                    <td class="${pointsClass}">${stat.points || 0}</td>
                    <td class="${ratingClass}">${stat.teamRating || '0.0'}</td>
                    <td class="${winsClass}">${stat.wins || 0}</td>
                    <td class="${podiumsClass}">${stat.podiums || 0}</td>
                    <td>${stat.fastestLaps || 0}</td>
                    <td class="${polesClass}">${stat.poles || 0}</td>
                    <td class="${dnfsClass}">${stat.dnfs || 0}</td>
                    <td>${stat.pointsPerRace || '0.0'}</td>
                    <td>${stat.podiumRate ? stat.podiumRate + '%' : '0%'}</td>
                    <td>${stat.championships || 0}</td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Update sort indicators in table headers
        this.updateSortIndicators('team');
        
        // Update dropdown selection
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = this.currentTeamSort;
        }
    }

    switchTab(tabId) {
        // Update active tab button
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        
        const activeButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        
        // Update tabs container data attribute
        const tabsContainer = document.querySelector('.championship-tabs');
        tabsContainer.dataset.activeTab = tabId;
        
        // Show active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`${tabId}-content`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
        
        // Update dropdown based on active tab
        this.updateDropdownForTab(tabId);
    }

    updateDropdownForTab(tabId) {
        const sortSelect = document.getElementById('sortSelect');
        
        if (tabId === 'driver-stats') {
            // Set dropdown to current driver sort
            sortSelect.value = this.currentDriverSort;
        } else if (tabId === 'team-stats') {
            // Set dropdown to current team sort
            sortSelect.value = this.currentTeamSort;
        }
    }

    changeSort(sortType) {
        const activeTab = document.querySelector('.championship-tabs').dataset.activeTab;
        
        if (activeTab === 'driver-stats') {
            this.currentDriverSort = sortType;
            this.displayDriverStats();
        } else if (activeTab === 'team-stats') {
            this.currentTeamSort = sortType;
            this.displayTeamStats();
        }
    }

    sortTable(sortKey) {
        const activeTab = document.querySelector('.championship-tabs').dataset.activeTab;
        
        if (activeTab === 'driver-stats') {
            // Toggle sort direction if clicking the same column
            if (this.currentDriverSort === sortKey) {
                this.driverSortDirection = this.driverSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.currentDriverSort = sortKey;
                this.driverSortDirection = 'desc'; // Default to descending for new sorts
            }
            
            this.displayDriverStats();
            
            // Update dropdown to match
            const sortSelect = document.getElementById('sortSelect');
            sortSelect.value = sortKey;
        } else if (activeTab === 'team-stats') {
            // Toggle sort direction if clicking the same column
            if (this.currentTeamSort === sortKey) {
                this.teamSortDirection = this.teamSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.currentTeamSort = sortKey;
                this.teamSortDirection = 'desc'; // Default to descending for new sorts
            }
            
            this.displayTeamStats();
            
            // Update dropdown to match
            const sortSelect = document.getElementById('sortSelect');
            sortSelect.value = sortKey;
        }
    }

    sortDriverStats(stats, sortKey, direction = 'desc') {
        return [...stats].sort((a, b) => {
            let aValue = a[sortKey] || 0;
            let bValue = b[sortKey] || 0;
            
            // Handle string values for names
            if (sortKey === 'driver') {
                if (direction === 'desc') {
                    return aValue.localeCompare(bValue);
                } else {
                    return bValue.localeCompare(aValue);
                }
            }
            
            // Handle numeric values
            if (typeof aValue === 'string' && !isNaN(aValue)) {
                aValue = parseFloat(aValue);
                bValue = parseFloat(bValue);
            }
            
            if (direction === 'desc') {
                return bValue - aValue;
            } else {
                return aValue - bValue;
            }
        });
    }

    sortTeamStats(stats, sortKey, direction = 'desc') {
        return [...stats].sort((a, b) => {
            let aValue = a[sortKey] || 0;
            let bValue = b[sortKey] || 0;
            
            // Handle string values for team names
            if (sortKey === 'team') {
                if (direction === 'desc') {
                    return aValue.localeCompare(bValue);
                } else {
                    return bValue.localeCompare(aValue);
                }
            }
            
            // Handle numeric values
            if (typeof aValue === 'string' && !isNaN(aValue)) {
                aValue = parseFloat(aValue);
                bValue = parseFloat(bValue);
            }
            
            if (direction === 'desc') {
                return bValue - aValue;
            } else {
                return aValue - bValue;
            }
        });
    }

    updateSortIndicators(type) {
        const sortKey = type === 'driver' ? this.currentDriverSort : this.currentTeamSort;
        const direction = type === 'driver' ? this.driverSortDirection : this.teamSortDirection;
        
        // Reset all sort indicators
        document.querySelectorAll('.sortable').forEach(th => {
            const arrows = th.querySelector('.sort-arrows');
            if (arrows) {
                arrows.innerHTML = '<i class="fas fa-sort"></i>';
                th.classList.remove('sort-asc', 'sort-desc');
            }
        });
        
        // Set active sort indicator
        const activeHeader = document.querySelector(`.sortable[data-sort="${sortKey}"]`);
        if (activeHeader) {
            const arrows = activeHeader.querySelector('.sort-arrows');
            if (arrows) {
                if (direction === 'asc') {
                    arrows.innerHTML = '<i class="fas fa-sort-up"></i>';
                    activeHeader.classList.add('sort-asc');
                } else {
                    arrows.innerHTML = '<i class="fas fa-sort-down"></i>';
                    activeHeader.classList.add('sort-desc');
                }
            }
        }
    }

    filterAndDisplayData() {
        if (!this.driverStats || !this.teamStats) return;
        
        // Filter driver stats
        if (this.currentSearchTerm) {
            this.filteredDriverStats = this.driverStats.filter(stat => 
                stat.driver.toLowerCase().includes(this.currentSearchTerm)
            );
        } else {
            this.filteredDriverStats = [...this.driverStats];
        }
        
        // Filter team stats
        if (this.currentSearchTerm) {
            this.filteredTeamStats = this.teamStats.filter(stat => 
                stat.team.toLowerCase().includes(this.currentSearchTerm)
            );
        } else {
            this.filteredTeamStats = [...this.teamStats];
        }
        
        // Update displays
        const activeTab = document.querySelector('.championship-tabs').dataset.activeTab;
        if (activeTab === 'driver-stats') {
            this.displayDriverStats();
        } else {
            this.displayTeamStats();
        }
        
        // Show empty state if no results
        if (activeTab === 'driver-stats' && this.filteredDriverStats.length === 0) {
            document.getElementById('driver-stats-body').innerHTML = 
                '<tr><td colspan="19" style="text-align: center; padding: 40px;">No drivers match your search</td></tr>';
        } else if (activeTab === 'team-stats' && this.filteredTeamStats.length === 0) {
            document.getElementById('team-stats-body').innerHTML = 
                '<tr><td colspan="12" style="text-align: center; padding: 40px;">No teams match your search</td></tr>';
        }
    }

    getTeamName(teamCode) {
        if (!this.teamMaster) return teamCode || 'Unknown';
        
        const team = this.teamMaster.find(t => t.id === teamCode);
        return team ? team.name : teamCode || 'Unknown';
    }

    getTeamColor(teamCode) {
        if (!this.teamMaster) return '#00f7ff';
        
        const team = this.teamMaster.find(t => t.id === teamCode);
        return team ? (team.primaryColor || '#00f7ff') : '#00f7ff';
    }

    showEmptyState() {
        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('empty-state').style.display = 'block';
    }

    /**
     * Update championship stats display
     */
    updateChampionshipStats() {
        // Get data from data loader
        const completedRaces = this.dataLoader.getCompletedRacesCount();
        const calendar = this.dataLoader.dataCache.raceCalendar || [];
        const totalRaces = calendar.length;
        
        // Find current round element (if exists)
        const currentRoundElement = document.getElementById('current-round');
        if (currentRoundElement) {
            currentRoundElement.textContent = `ROUND ${completedRaces}/${totalRaces}`;
        }
    }

    /**
     * Start next race countdown timer
     */
    startNextRaceCountdown() {
        const calendar = this.dataLoader.dataCache.raceCalendar || [];
        const completedRaces = this.dataLoader.getCompletedRacesCount();
        
        // Clear any existing interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Get the timer display element from header
        const timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) {
            console.error('Timer display element not found');
            return;
        }
        
        // If season hasn't started yet
        if (completedRaces === 0 && calendar.length > 0) {
            const firstRace = calendar[0];
            this.updateNextRaceCountdown(firstRace.date, timerDisplay);
        }
        // If season is in progress
        else if (completedRaces < calendar.length && calendar.length > 0) {
            const nextRace = calendar[completedRaces];
            this.updateNextRaceCountdown(nextRace.date, timerDisplay);
        }
        // If season is completed
        else {
            timerDisplay.textContent = 'SEASON COMPLETED';
        }
    }

    /**
     * Update next race countdown display
     */
    updateNextRaceCountdown(dateStr, timerDisplay) {
        // Clear any existing interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        // Set initial text while parsing
        timerDisplay.textContent = 'Loading...';
        
        // Try to parse the date
        let targetDate;
        
        try {
            // Use the data loader's formatDate method to ensure consistent parsing
            const formattedDateStr = this.dataLoader.formatDate(dateStr);
            
            if (formattedDateStr === 'TBD' || formattedDateStr === 'Coming Soon') {
                timerDisplay.textContent = 'DATE TBD';
                return;
            }
            
            // Parse the formatted date
            targetDate = new Date(formattedDateStr);
            
            if (isNaN(targetDate.getTime())) {
                throw new Error('Invalid date');
            }
            
            // Check if race has already passed
            const now = new Date();
            if (targetDate < now) {
                timerDisplay.textContent = 'RACE DAY!';
                return;
            }
            
        } catch (error) {
            console.error('Failed to parse date for countdown:', dateStr, error);
            timerDisplay.textContent = 'DATE TBD';
            return;
        }
        
        // Update countdown function
        const updateCountdownDisplay = () => {
            const now = new Date();
            const diff = targetDate - now;
            
            if (diff <= 0) {
                timerDisplay.textContent = 'RACE DAY!';
                clearInterval(this.countdownInterval);
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            // Format with leading zeros for single-digit minutes and seconds
            const formattedHours = hours.toString().padStart(2, '0');
            const formattedMinutes = minutes.toString().padStart(2, '0');
            const formattedSeconds = seconds.toString().padStart(2, '0');
            
            const countdownStr = `${days}d ${formattedHours}h ${formattedMinutes}m ${formattedSeconds}s`;
            timerDisplay.textContent = countdownStr;
        };
        
        // Update immediately
        updateCountdownDisplay();
        
        // Update every second
        this.countdownInterval = setInterval(updateCountdownDisplay, 1000);
    }

    /**
     * Add refresh button to the page
     */
    addRefreshButton() {
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄';
        refreshBtn.className = 'refresh-btn';
        refreshBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:1000;background:var(--primary);color:white;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
        refreshBtn.title = 'Refresh Data';
        refreshBtn.addEventListener('click', () => this.refreshData());
        document.body.appendChild(refreshBtn);
    }

    /**
     * Refresh all data and restart countdown
     */
    async refreshData() {
        console.log('Refreshing stats data...');
        
        // Clear existing countdown
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        // Clear data cache and reload
        this.dataLoader.dataCache = {};
        await this.loadAndDisplayData();
        
        // Restart countdown
        this.startNextRaceCountdown();
        
        // Show refresh feedback
        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            const originalText = refreshBtn.textContent;
            refreshBtn.textContent = '✓';
            refreshBtn.style.background = '#4CAF50';
            setTimeout(() => {
                refreshBtn.textContent = originalText;
                refreshBtn.style.background = '';
            }, 1000);
        }
    }
}

// Initialize stats page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.efcStatsPage = new EFCStatsPage();
});
