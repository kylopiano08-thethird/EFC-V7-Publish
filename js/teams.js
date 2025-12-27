/**
 * TEAMS PAGE - REBUILT FROM SCRATCH
 * Simple, clean, working implementation
 */

class TeamsManager {
    constructor() {
        this.dataLoader = efcDataLoader;
        this.isInitialized = false;
        this.expandedTeamId = null;
        this.allTeams = [];
        this.allTeamStats = [];
        this.allPersonnel = [];
        this.driverPictures = {};
        this.filteredTeams = [];
        
        // Cache DOM elements
        this.elements = {
            teamsGrid: document.getElementById('teams-grid'),
            teamsSearchInput: document.getElementById('teams-search-input')
        };
    }
    
    /**
     * Initialize the page
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Initializing Teams Manager...');
        
        try {
            // Load all data
            await this.loadData();
            
            // Process and merge data
            this.processTeams();
            
            // Render everything
            this.render();
            this.setupEventListeners();
            
            // Start the countdown timer
            this.startCountdownTimer();
            
            this.isInitialized = true;
            console.log('Teams Manager initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError();
        }
    }
    
    /**
     * Load data from Google Sheets
     */
    async loadData() {
        console.log('Loading data from Google Sheets...');
        
        try {
            // Load all four sheets in parallel
            const [teamMasterData, teamStatsData, personnelData, driverMasterData] = await Promise.all([
                this.dataLoader.fetchCSV('TeamMaster'),
                this.dataLoader.fetchCSV('TeamStats'),
                this.dataLoader.fetchCSV('Owners and Engineers'),
                this.dataLoader.fetchCSV('DriverMaster')
            ]);
            
            // Parse TeamMaster
            if (teamMasterData) {
                this.allTeams = this.parseTeamMaster(teamMasterData);
                console.log(`Loaded ${this.allTeams.length} teams from TeamMaster`);
            }
            
            // Parse TeamStats (FIXED PARSING)
            if (teamStatsData) {
                this.allTeamStats = this.parseTeamStatsFixed(teamStatsData);
                console.log(`Loaded ${this.allTeamStats.length} team stats from TeamStats`);
            }
            
            // Parse Personnel from Owners and Engineers
            if (personnelData) {
                this.allPersonnel = this.parsePersonnelFixed(personnelData);
                console.log(`Loaded ${this.allPersonnel.length} personnel records from Owners and Engineers`);
            }
            
            // Parse Driver Pictures from DriverMaster
            if (driverMasterData) {
                this.driverPictures = this.parseDriverPictures(driverMasterData);
                console.log(`Loaded ${Object.keys(this.driverPictures).length} driver pictures from DriverMaster`);
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }
    
    /**
     * Parse TeamMaster CSV
     */
    parseTeamMaster(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const teams = [];
        const headers = this.dataLoader.parseCSVLine(lines[0]);
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.dataLoader.parseCSVLine(lines[i]);
            if (values.length < 3) continue;
            
            const team = {
                // Basic info
                name: values[0]?.trim() || '',
                sponsor: values[1]?.trim() || '',
                id: values[2]?.trim() || '',
                
                // Colors
                primaryColor: this.validateColor(values[3]?.trim() || '#00f7ff'),
                secondaryColor: this.validateColor(values[4]?.trim() || '#ffffff'),
                
                // Design
                logoUrl: values[5]?.trim() || '',
                carImageUrl: values[6]?.trim() || '',
                
                // Personnel from TeamMaster
                driver1: values[7]?.trim() || '',
                driver2: values[8]?.trim() || '',
                reserve1: values[9]?.trim() || '',
                reserve2: values[10]?.trim() || '',
                teamOwner: values[11]?.trim() || '',
                teamPrincipal: values[12]?.trim() || '',
                engineer: values[13]?.trim() || '',
                
                // Description
                description: values[14]?.trim() || '',
                active: values[15]?.trim() === 'y'
            };
            
            if (team.id && team.name) {
                teams.push(team);
            }
        }
        
        return teams;
    }
    
    /**
     * Validate and format color
     */
    validateColor(color) {
        if (!color) return '#00f7ff';
        
        // Remove any spaces
        color = color.trim();
        
        // Check if it's a valid hex color
        if (/^#[0-9A-F]{6}$/i.test(color)) {
            return color;
        }
        
        // Check if it's a valid hex color without #
        if (/^[0-9A-F]{6}$/i.test(color)) {
            return `#${color}`;
        }
        
        // Check if it's a valid 3-digit hex
        if (/^#[0-9A-F]{3}$/i.test(color)) {
            // Convert 3-digit to 6-digit
            return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
        }
        
        // Default color
        return '#00f7ff';
    }
    
    /**
     * Parse TeamStats CSV - FIXED VERSION
     * Column A: Team, B: Points, C: Podiums, D: Wins, E: Team Rating, 
     * F: Fastest Laps, G: Poles, H: DNFs, I: Points Per Race, J: Podium Rate, K: Championships
     */
    parseTeamStatsFixed(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const stats = [];
        const headers = this.dataLoader.parseCSVLine(lines[0]);
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.dataLoader.parseCSVLine(lines[i]);
            if (values.length < 2) continue;
            
            const stat = {
                team: values[0]?.trim() || '',
                points: this.parseNumber(values[1]),
                wins: this.parseNumber(values[3]),
                teamRating: this.parseNumber(values[4]),
                championships: this.parseNumber(values[10] || 0)
            };
            
            if (stat.team) {
                stats.push(stat);
            }
        }
        
        return stats;
    }
    
    /**
     * Parse Personnel CSV from Owners and Engineers - FIXED VERSION
     * Column A: Name, B: Role (Engineer or Owner), C: Team, D: Discord, E: Picture, F: Description
     */
    parsePersonnelFixed(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const personnel = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.dataLoader.parseCSVLine(lines[i]);
            if (values.length < 3) continue;
            
            const person = {
                name: values[0]?.trim() || '',
                role: values[1]?.trim() || '',
                team: values[2]?.trim() || '',
                discord: values[3]?.trim() || '',
                picture: values[4]?.trim() || '',
                description: values[5]?.trim() || ''
            };
            
            if (person.name && person.team) {
                personnel.push(person);
            }
        }
        
        return personnel;
    }
    
    /**
     * Parse Driver Pictures from DriverMaster
     * Column I contains driver pictures
     */
    parseDriverPictures(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return {};
        
        const driverPictures = {};
        const headers = this.dataLoader.parseCSVLine(lines[0]);
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.dataLoader.parseCSVLine(lines[i]);
            if (values.length < 9) continue;
            
            const driverName = values[0]?.trim() || '';
            const pictureUrl = values[8]?.trim() || ''; // Column I is index 8
            
            if (driverName && pictureUrl) {
                driverPictures[driverName.toLowerCase()] = pictureUrl;
            }
        }
        
        return driverPictures;
    }
    
    /**
     * Process and merge all team data
     */
    processTeams() {
        console.log('Processing and merging team data...');
        
        // Match stats to teams
        this.allTeams.forEach(team => {
            // Find matching stats
            const teamStats = this.findMatchingStats(team);
            team.stats = teamStats || this.getDefaultStats();
            
            // Find matching personnel from Owners and Engineers
            team.additionalPersonnel = this.findMatchingPersonnel(team);
            
            // Set points for sorting
            team.points = team.stats.points || 0;
        });
        
        // Sort teams by points
        this.allTeams.sort((a, b) => b.points - a.points);
        
        // Add positions
        this.allTeams.forEach((team, index) => {
            team.position = index + 1;
        });
        
        this.filteredTeams = [...this.allTeams];
        
        console.log('Teams processed:', this.allTeams.length);
    }
    
    /**
     * Find matching stats for a team
     */
    findMatchingStats(team) {
        if (!this.allTeamStats.length) return null;
        
        // Try multiple matching strategies
        return this.allTeamStats.find(stats => {
            const teamName = team.name.toLowerCase();
            const teamId = team.id.toLowerCase();
            const statsTeam = stats.team.toLowerCase();
            
            // Exact matches
            if (statsTeam === teamName || statsTeam === teamId) return true;
            
            // Partial matches
            if (teamName.includes(statsTeam) || statsTeam.includes(teamName)) return true;
            
            // Check for sponsor in name
            if (team.sponsor) {
                const teamWithSponsor = `${team.name} ${team.sponsor}`.toLowerCase();
                if (statsTeam === teamWithSponsor) return true;
            }
            
            return false;
        });
    }
    
    /**
     * Find matching personnel for a team from Owners and Engineers
     */
    findMatchingPersonnel(team) {
        if (!this.allPersonnel.length) return [];
        
        return this.allPersonnel.filter(person => {
            const teamName = team.name.toLowerCase();
            const teamId = team.id.toLowerCase();
            const personTeam = person.team.toLowerCase();
            
            return personTeam === teamName || 
                   personTeam === teamId ||
                   teamName.includes(personTeam) || 
                   personTeam.includes(teamName);
        });
    }
    
    /**
     * Get picture for a person (driver, owner, engineer)
     */
    getPersonPicture(personName, role) {
        // First check if we have a picture from Owners and Engineers
        const personnelRecord = this.allPersonnel.find(p => 
            p.name.toLowerCase() === personName.toLowerCase() && p.role === role
        );
        
        if (personnelRecord?.picture) {
            return personnelRecord.picture;
        }
        
        // For drivers, check DriverMaster
        if (role.includes('Driver') || role === 'Driver 1' || role === 'Driver 2' || 
            role === 'Reserve Driver 1' || role === 'Reserve Driver 2') {
            return this.driverPictures[personName.toLowerCase()] || '';
        }
        
        return '';
    }
    
    /**
     * Get default stats object
     */
    getDefaultStats() {
        return {
            points: 0,
            wins: 0,
            teamRating: 0,
            championships: 0
        };
    }
    
    /**
     * Parse number safely
     */
    parseNumber(value) {
        if (!value || value.toString().trim() === '') return 0;
        
        // Remove any non-numeric characters except decimal point
        const cleanValue = value.toString().replace(/[^\d.-]/g, '');
        const num = parseFloat(cleanValue);
        return isNaN(num) ? 0 : Math.round(num);
    }
    
    /**
     * Render everything
     */
    render() {
        this.renderTeamsGrid();
    }
    
    /**
     * Render teams grid
     */
    renderTeamsGrid() {
        if (!this.elements.teamsGrid) return;
        
        if (this.filteredTeams.length === 0) {
            this.elements.teamsGrid.innerHTML = `
                <div class="teams-loading">
                    <i class="fas fa-search"></i>
                    <p>No teams found</p>
                </div>
            `;
            return;
        }
        
        // Create HTML for all teams
        const teamsHTML = this.filteredTeams.map(team => this.createTeamCardHTML(team)).join('');
        this.elements.teamsGrid.innerHTML = teamsHTML;
        
        // Add click handlers
        this.addCardClickHandlers();
    }
    
    /**
     * Create HTML for a team card with team colors
     */
    createTeamCardHTML(team) {
        const isExpanded = this.expandedTeamId === team.id;
        const teamStats = team.stats || this.getDefaultStats();
        const primaryColor = team.primaryColor;
        const secondaryColor = team.secondaryColor;
        
        // Create CSS variables for team colors
        const styleVars = `
            --team-primary: ${primaryColor};
            --team-secondary: ${secondaryColor};
            --team-primary-20: ${primaryColor}20;
            --team-primary-30: ${primaryColor}30;
            --team-primary-40: ${primaryColor}40;
            --team-primary-60: ${primaryColor}60;
            --team-secondary-10: ${secondaryColor}10;
            --team-secondary-15: ${secondaryColor}15;
            --team-secondary-40: ${secondaryColor}40;
            --team-secondary-50: ${secondaryColor}50;
        `;
        
        return `
            <div class="team-card ${isExpanded ? 'expanded' : ''}" 
                 data-team-id="${team.id}"
                 style="${styleVars}">
                
                <!-- Card Header -->
                <div class="team-card-header">
                    <div class="team-logo-container">
                        ${team.logoUrl ? `
                            <img src="${team.logoUrl}" alt="${team.name}" class="team-logo">
                        ` : `
                            <div class="team-logo-placeholder">
                                <i class="fas fa-flag"></i>
                            </div>
                        `}
                    </div>
                    
                    <div class="team-header-info">
                        <div class="team-position">#${team.position}</div>
                        <h3 class="team-name">${team.name}</h3>
                    </div>
                    
                    <div class="team-points-badge">
                        <i class="fas fa-star"></i>
                        ${teamStats.points}
                    </div>
                </div>
                
                <!-- Car Image -->
                <div class="team-card-content">
                    <div class="team-car-container">
                        ${team.carImageUrl ? `
                            <img src="${team.carImageUrl}" alt="${team.name} Car" class="team-car-image">
                        ` : `
                            <div class="team-car-placeholder">
                                <i class="fas fa-car"></i>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Expanded Content (shown when expanded) -->
                ${isExpanded ? this.createExpandedContentHTML(team) : ''}
            </div>
        `;
    }
    
    /**
     * Create expanded content HTML
     */
    createExpandedContentHTML(team) {
        const teamStats = team.stats || this.getDefaultStats();
        
        return `
            <div class="team-expanded-content">
                <!-- Team Statistics - SIMPLIFIED -->
                <div class="expanded-section">
                    <h4 class="section-title">
                        <i class="fas fa-chart-bar"></i> TEAM STATISTICS
                    </h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-label">Total Points</div>
                            <div class="stat-value">${teamStats.points}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Team Rating</div>
                            <div class="stat-value">${teamStats.teamRating || 'N/A'}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Wins</div>
                            <div class="stat-value">${teamStats.wins}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Championships</div>
                            <div class="stat-value">${teamStats.championships}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Team Personnel - SEPARATED into Leadership and Drivers -->
                <div class="expanded-section">
                    <h4 class="section-title">
                        <i class="fas fa-users"></i> TEAM PERSONNEL
                    </h4>
                    <div class="personnel-section-content">
                        ${this.createLeadershipCardsHTML(team)}
                        ${this.createDriverCardsHTML(team)}
                    </div>
                </div>
                
                <!-- Team Description -->
                ${team.description ? `
                    <div class="expanded-section">
                        <h4 class="section-title">
                            <i class="fas fa-file-alt"></i> ABOUT ${team.name.toUpperCase()}
                        </h4>
                        <div class="team-description-box">
                            ${team.description}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * Create leadership cards HTML (Owners and Engineers - BIG CARDS)
     */
    createLeadershipCardsHTML(team) {
        const primaryColor = team.primaryColor;
        const secondaryColor = team.secondaryColor;
        
        // Leadership personnel (Owners and Engineers)
        const leadershipMembers = [
            { 
                role: 'Team Owner', 
                name: team.teamOwner, 
                icon: 'crown', 
                color: primaryColor,
                description: 'Team Owner and Principal',
                contractLength: 'N/A',
                experience: 'N/A',
                nationality: 'N/A'
            },
            { 
                role: 'Team Principal', 
                name: team.teamPrincipal, 
                icon: 'user-tie', 
                color: secondaryColor || primaryColor,
                description: 'Team Principal and Manager',
                contractLength: 'N/A',
                experience: 'N/A',
                nationality: 'N/A'
            },
            { 
                role: 'Chief Engineer', 
                name: team.engineer, 
                icon: 'tools', 
                color: this.blendColors(primaryColor, secondaryColor),
                description: 'Chief Race Engineer',
                contractLength: 'N/A',
                experience: 'N/A',
                nationality: 'N/A'
            }
        ];
        
        // Add additional leadership from Owners & Engineers sheet
        const additionalMembers = team.additionalPersonnel || [];
        
        additionalMembers.forEach(externalPerson => {
            // Check if this person is a leader (owner or engineer)
            const isLeader = externalPerson.role.toLowerCase().includes('owner') || 
                           externalPerson.role.toLowerCase().includes('engineer');
            
            if (isLeader) {
                // Check if this person already exists in our list
                const exists = leadershipMembers.some(person => 
                    person.name.toLowerCase() === externalPerson.name.toLowerCase()
                );
                
                if (!exists) {
                    // Map the role to appropriate icon and color
                    let icon = 'user-tie';
                    let color = primaryColor;
                    let description = externalPerson.description || '';
                    
                    if (externalPerson.role.toLowerCase().includes('owner')) {
                        icon = 'crown';
                        color = primaryColor;
                        description = description || 'Team Owner';
                    } else if (externalPerson.role.toLowerCase().includes('engineer')) {
                        icon = 'tools';
                        color = this.blendColors(primaryColor, secondaryColor);
                        description = description || 'Technical Engineer';
                    }
                    
                    leadershipMembers.push({
                        role: externalPerson.role,
                        name: externalPerson.name,
                        icon: icon,
                        color: color,
                        picture: externalPerson.picture,
                        description: description,
                        contractLength: 'N/A',
                        experience: 'N/A',
                        nationality: 'N/A'
                    });
                }
            }
        });
        
        // Filter out empty entries and create cards
        const validLeadership = leadershipMembers.filter(member => member.name && member.name.trim());
        
        if (validLeadership.length === 0) {
            return `
                <div class="leadership-grid">
                    <div class="leadership-card">
                        <div class="leadership-header">
                            <div class="leadership-icon" style="
                                background: ${primaryColor}20;
                                border-color: ${primaryColor}60;
                            ">
                                <i class="fas fa-users" style="color: ${primaryColor};"></i>
                            </div>
                            <div class="leadership-info">
                                <div class="leadership-role" style="color: ${primaryColor}80;">No Leadership Data</div>
                                <div class="leadership-name" style="color: ${primaryColor};">Information not available</div>
                                <div class="leadership-description">Team leadership information could not be loaded</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        const leadershipCards = validLeadership.map(member => this.createLeadershipCardHTML(member)).join('');
        return `<div class="leadership-grid">${leadershipCards}</div>`;
    }
    
    /**
     * Create leadership card HTML (BIG CARD)
     */
    createLeadershipCardHTML(member) {
        const icon = member.icon || 'user-tie';
        const color = member.color || '#666';
        const description = member.description || '';
        
        // Get picture if available
        const picture = member.picture || this.getPersonPicture(member.name, member.role);
        
        return `
            <div class="leadership-card">
                <div class="leadership-header">
                    ${picture ? `
                        <div class="leadership-icon" style="
                            background: ${color}20;
                            padding: 0;
                            border-color: ${color}60;
                        ">
                            <img src="${picture}" alt="${member.name}" style="
                                width: 100%;
                                height: 100%;
                                border-radius: 50%;
                                object-fit: cover;
                            ">
                        </div>
                    ` : `
                        <div class="leadership-icon" style="
                            background: ${color}20;
                            border-color: ${color}60;
                        ">
                            <i class="fas fa-${icon}" style="color: ${color};"></i>
                        </div>
                    `}
                    <div class="leadership-info">
                        <div class="leadership-role" style="color: ${color}80;">${member.role}</div>
                        <div class="leadership-name" style="color: ${color};">${member.name}</div>
                        ${description ? `<div class="leadership-description">${description}</div>` : ''}
                    </div>
                </div>
                <div class="leadership-details">
                    <div class="leadership-detail">
                        <div class="detail-label">Contract Length</div>
                        <div class="detail-value">${member.contractLength || 'N/A'}</div>
                    </div>
                    <div class="leadership-detail">
                        <div class="detail-label">Experience</div>
                        <div class="detail-value">${member.experience || 'N/A'}</div>
                    </div>
                    <div class="leadership-detail">
                        <div class="detail-label">Nationality</div>
                        <div class="detail-value">${member.nationality || 'N/A'}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Create driver cards HTML (Drivers - SMALL CARDS)
     */
    createDriverCardsHTML(team) {
        const primaryColor = team.primaryColor;
        const secondaryColor = team.secondaryColor;
        
        // Driver personnel
        const driverMembers = [
            { 
                role: 'Driver 1', 
                name: team.driver1, 
                icon: 'helmet-safety', 
                color: primaryColor,
                description: 'Primary Driver'
            },
            { 
                role: 'Driver 2', 
                name: team.driver2, 
                icon: 'helmet-safety', 
                color: secondaryColor || this.lightenColor(primaryColor, 30),
                description: 'Secondary Driver'
            }
        ];
        
        // Filter out empty driver entries
        const validDrivers = driverMembers.filter(driver => driver.name && driver.name.trim());
        
        // Reserve drivers section if available
        const reserveDrivers = [
            { 
                role: 'Reserve Driver 1', 
                name: team.reserve1, 
                icon: 'user-clock', 
                color: this.darkenColor(primaryColor, 20),
                description: 'First Reserve Driver'
            },
            { 
                role: 'Reserve Driver 2', 
                name: team.reserve2, 
                icon: 'user-clock', 
                color: this.darkenColor(secondaryColor || primaryColor, 20),
                description: 'Second Reserve Driver'
            }
        ];
        
        const validReserves = reserveDrivers.filter(driver => driver.name && driver.name.trim());
        
        if (validDrivers.length === 0) {
            return `
                <div class="drivers-grid">
                    <div class="driver-card">
                        <div class="driver-icon" style="
                            background: ${primaryColor}20;
                            border-color: ${primaryColor}60;
                        ">
                            <i class="fas fa-user" style="color: ${primaryColor};"></i>
                        </div>
                        <div class="driver-info">
                            <div class="driver-role" style="color: ${primaryColor}80;">No Drivers Data</div>
                            <div class="driver-name" style="color: ${primaryColor};">Information not available</div>
                                <div class="driver-description">Driver information could not be loaded</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        let driversHTML = `
            <div class="drivers-grid">
                ${validDrivers.map(driver => this.createDriverCardHTML(driver)).join('')}
            </div>
        `;
        
        // Add reserve drivers section if there are any
        if (validReserves.length > 0) {
            driversHTML += `
                <div class="reserve-section">
                    <h5 class="reserve-title">
                        <i class="fas fa-user-clock"></i> RESERVE DRIVERS
                    </h5>
                    <div class="drivers-grid">
                        ${validReserves.map(driver => this.createDriverCardHTML(driver)).join('')}
                    </div>
                </div>
            `;
        }
        
        return driversHTML;
    }
    
    /**
     * Create driver card HTML (SMALL CARD)
     */
    createDriverCardHTML(driver) {
        const icon = driver.icon || 'helmet-safety';
        const color = driver.color || '#666';
        const description = driver.description || '';
        
        // Get picture if available
        const picture = driver.picture || this.getPersonPicture(driver.name, driver.role);
        
        return `
            <div class="driver-card">
                ${picture ? `
                    <div class="driver-icon" style="
                        background: ${color}20;
                        padding: 0;
                        border-color: ${color}60;
                    ">
                        <img src="${picture}" alt="${driver.name}" style="
                            width: 100%;
                            height: 100%;
                            border-radius: 50%;
                            object-fit: cover;
                        ">
                    </div>
                ` : `
                    <div class="driver-icon" style="
                        background: ${color}20;
                        border-color: ${color}60;
                    ">
                        <i class="fas fa-${icon}" style="color: ${color};"></i>
                    </div>
                `}
                <div class="driver-info">
                    <div class="driver-role" style="color: ${color}80;">${driver.role}</div>
                    <div class="driver-name" style="color: ${color};">${driver.name}</div>
                    ${description ? `<div class="driver-description">${description}</div>` : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Blend two colors
     */
    blendColors(color1, color2, weight = 0.5) {
        if (!color2) return color1;
        
        // Convert hex to RGB
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        
        const rgb1 = hexToRgb(color1);
        const rgb2 = hexToRgb(color2);
        
        if (!rgb1 || !rgb2) return color1;
        
        // Blend the colors
        const r = Math.round(rgb1.r * weight + rgb2.r * (1 - weight));
        const g = Math.round(rgb1.g * weight + rgb2.g * (1 - weight));
        const b = Math.round(rgb1.b * weight + rgb2.b * (1 - weight));
        
        // Convert back to hex
        const toHex = (c) => {
            const hex = c.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    
    /**
     * Lighten a color
     */
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return `#${(
            0x1000000 +
            (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)
        ).toString(16).slice(1)}`;
    }
    
    /**
     * Darken a color
     */
    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        
        return `#${(
            0x1000000 +
            (R > 0 ? R > 255 ? 255 : R : 0) * 0x10000 +
            (G > 0 ? G > 255 ? 255 : G : 0) * 0x100 +
            (B > 0 ? B > 255 ? 255 : B : 0)
        ).toString(16).slice(1)}`;
    }
    
    /**
     * Add click handlers to cards
     */
    addCardClickHandlers() {
        const cards = document.querySelectorAll('.team-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on a link or button
                if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') {
                    return;
                }
                
                const teamId = card.dataset.teamId;
                this.toggleCardExpansion(teamId);
            });
        });
    }
    
    /**
     * Toggle card expansion
     */
    toggleCardExpansion(teamId) {
        // If clicking the same card, collapse it
        if (this.expandedTeamId === teamId) {
            this.expandedTeamId = null;
        } else {
            this.expandedTeamId = teamId;
        }
        
        // Re-render the grid
        this.renderTeamsGrid();
        
        // Scroll to expanded card
        if (this.expandedTeamId) {
            setTimeout(() => {
                const expandedCard = document.querySelector(`.team-card.expanded[data-team-id="${this.expandedTeamId}"]`);
                if (expandedCard) {
                    expandedCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search
        if (this.elements.teamsSearchInput) {
            this.elements.teamsSearchInput.addEventListener('input', (e) => {
                this.filterTeams(e.target.value);
            });
        }
    }
    
    /**
     * Filter teams by search
     */
    filterTeams(query) {
        if (!query.trim()) {
            this.filteredTeams = [...this.allTeams];
        } else {
            const searchTerm = query.toLowerCase();
            this.filteredTeams = this.allTeams.filter(team => {
                return team.name.toLowerCase().includes(searchTerm) ||
                       team.id.toLowerCase().includes(searchTerm) ||
                       (team.sponsor && team.sponsor.toLowerCase().includes(searchTerm)) ||
                       (team.driver1 && team.driver1.toLowerCase().includes(searchTerm)) ||
                       (team.driver2 && team.driver2.toLowerCase().includes(searchTerm)) ||
                       (team.teamOwner && team.teamOwner.toLowerCase().includes(searchTerm));
            });
        }
        
        this.expandedTeamId = null; // Collapse any expanded card
        this.renderTeamsGrid();
    }
    
    /**
     * Start countdown timer for next race
     */
        /**
     * Start countdown timer for next race
     */
        /**
     * Start countdown timer for next race - DEBUG VERSION
     */
    async startCountdownTimer() {
        console.log('Starting countdown timer...');
        
        try {
            // Load homepage data to get everything at once
            const data = await this.dataLoader.loadHomepageData();
            console.log('Homepage data loaded:', data);
            
            const calendar = data.raceCalendar || [];
            const completedRaces = this.dataLoader.getCompletedRacesCount();
            
            console.log('Calendar data:', {
                totalRaces: calendar.length,
                completedRaces: completedRaces,
                races: calendar.map(r => ({ name: r.name, date: r.date, rawDate: r.date }))
            });
            
            // Clear any existing interval
            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
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
                formattedDate: this.dataLoader.formatDate(nextRace.date)
            });
            
            // Use the data loader's formatDate method
            const formattedDateStr = this.dataLoader.formatDate(nextRace.date);
            
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
                    clearInterval(this.countdownInterval);
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
            this.countdownInterval = setInterval(updateCountdownDisplay, 1000);
            
        } catch (error) {
            console.error('Error in startCountdownTimer:', error);
            const timerDisplay = document.getElementById('timer-display');
            if (timerDisplay) {
                timerDisplay.textContent = 'ERROR';
            }
        }
    }
    
    /**
     * Load race calendar data - using the same method as stats page
     */
    async loadRaceCalendar() {
        try {
            const data = await this.dataLoader.fetchCSV('RaceCalendar');
            if (!data) return [];
            
            return this.parseRaceCalendar(data);
        } catch (error) {
            console.error('Error loading race calendar:', error);
            return [];
        }
    }
    
    /**
     * Parse race calendar CSV - same as stats page
     */
    parseRaceCalendar(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const calendar = [];
        const headers = this.dataLoader.parseCSVLine(lines[0]);
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.dataLoader.parseCSVLine(lines[i]);
            if (values.length < 7) continue;
            
            const race = {
                round: values[0]?.trim() || '',
                track: values[1]?.trim() || '',
                location: values[2]?.trim() || '',
                date: values[3]?.trim() || '',
                qualifying: values[4]?.trim() || '',
                sprint: values[5]?.trim() || '',
                completed: values[6]?.trim() === 'y' || false
            };
            
            if (race.track && race.date) {
                calendar.push(race);
            }
        }
        
        return calendar;
    }
    
    /**
     * Get count of completed races - same as stats page
     */
    getCompletedRacesCount(calendar) {
        return calendar.filter(race => race.completed).length;
    }
    
    /**
     * Update next race countdown display - using EXACTLY the same logic as stats page
     */
    updateNextRaceCountdown(dateStr, timerDisplay) {
        // Clear any existing interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        // Set initial text while parsing
        timerDisplay.textContent = 'Loading...';
        
        // Try to parse the date - USE THE SAME METHOD AS STATS PAGE
        let targetDate;
        
        try {
            // Use the data loader's formatDate method to ensure consistent parsing
            // This is the key change - using the same method as stats.js
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
        
        // Update countdown function - same as stats page
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
     * Parse race calendar CSV
     */
    parseRaceCalendar(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const calendar = [];
        const headers = this.dataLoader.parseCSVLine(lines[0]);
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.dataLoader.parseCSVLine(lines[i]);
            if (values.length < 7) continue;
            
            const race = {
                round: values[0]?.trim() || '',
                track: values[1]?.trim() || '',
                location: values[2]?.trim() || '',
                date: values[3]?.trim() || '',
                qualifying: values[4]?.trim() || '',
                sprint: values[5]?.trim() || '',
                completed: values[6]?.trim() === 'y' || false
            };
            
            if (race.track && race.date) {
                calendar.push(race);
            }
        }
        
        return calendar;
    }
    
    /**
     * Get count of completed races
     */
    getCompletedRacesCount(calendar) {
        return calendar.filter(race => race.completed).length;
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
            // Try to parse the date string
            targetDate = new Date(dateStr);
            
            // Check if it's a valid date
            if (isNaN(targetDate.getTime())) {
                // Try alternative date parsing
                const parsedDate = this.parseDateString(dateStr);
                if (parsedDate) {
                    targetDate = parsedDate;
                } else {
                    throw new Error('Invalid date format');
                }
            }
            
            if (isNaN(targetDate.getTime())) {
                timerDisplay.textContent = 'DATE TBD';
                return;
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
     * Try to parse various date string formats
     */
    parseDateString(dateStr) {
        if (!dateStr || dateStr.trim() === '') return null;
        
        // Clean the date string
        dateStr = dateStr.trim();
        
        // Check for common date formats
        const dateFormats = [
            'MM/DD/YYYY',
            'YYYY-MM-DD',
            'DD/MM/YYYY',
            'MM-DD-YYYY',
            'YYYY/MM/DD'
        ];
        
        for (const format of dateFormats) {
            try {
                let parts;
                if (format.includes('/')) {
                    parts = dateStr.split('/');
                } else if (format.includes('-')) {
                    parts = dateStr.split('-');
                } else {
                    continue;
                }
                
                if (parts.length !== 3) continue;
                
                let year, month, day;
                
                if (format === 'MM/DD/YYYY' || format === 'MM-DD-YYYY') {
                    month = parseInt(parts[0]) - 1; // Month is 0-indexed in JS
                    day = parseInt(parts[1]);
                    year = parseInt(parts[2]);
                } else if (format === 'YYYY-MM-DD' || format === 'YYYY/MM/DD') {
                    year = parseInt(parts[0]);
                    month = parseInt(parts[1]) - 1;
                    day = parseInt(parts[2]);
                } else if (format === 'DD/MM/YYYY') {
                    day = parseInt(parts[0]);
                    month = parseInt(parts[1]) - 1;
                    year = parseInt(parts[2]);
                }
                
                // Check if date components are valid
                if (isNaN(year) || isNaN(month) || isNaN(day)) continue;
                if (year < 2000 || year > 2100) continue;
                if (month < 0 || month > 11) continue;
                if (day < 1 || day > 31) continue;
                
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            } catch (error) {
                continue;
            }
        }
        
        // Try direct Date.parse as last resort
        const date = new Date(dateStr);
        return !isNaN(date.getTime()) ? date : null;
    }
    
    /**
     * Show error state
     */
    showError() {
        if (this.elements.teamsGrid) {
            this.elements.teamsGrid.innerHTML = `
                <div class="teams-loading">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load team data</p>
                </div>
            `;
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const teamsManager = new TeamsManager();
    teamsManager.initialize();
});