// ===== POSITION TRACKING MODULE =====
const PositionTracker = {
    // Configuration
    CONFIG: {
        SHEET_ID: '1bAxn0H6xgi81Ms7c6TuRI1SdCssQDaajb0JwCkKS1gw',
    },

    // Initialize the tracker
    async init() {
        console.log('Position Tracker initialized');
        // Pre-calculate changes when the page loads
        await this.calculateAllChanges();
    },

    // Get the last two completed races
    async getLastTwoCompletedRaces() {
        try {
            const standings = await this.loadSheetData('Championship Standings');
            if (!standings || standings.length === 0) {
                console.log('No standings data found');
                return { lastRace: null, previousRace: null };
            }
            
            const sampleDriver = standings.find(driver => driver.racePoints && Object.keys(driver.racePoints).length > 0);
            if (!sampleDriver) {
                console.log('No driver with race points found');
                return { lastRace: null, previousRace: null };
            }
            
            const allRaceNames = Object.keys(sampleDriver.racePoints);
            const completedRaces = [];
            
            for (const race of allRaceNames) {
                const hasNonZeroPoints = standings.some(driver => {
                    const points = driver.racePoints && driver.racePoints[race];
                    return points !== undefined && points !== null && points > 0;
                });
                
                if (hasNonZeroPoints) {
                    completedRaces.push(race);
                }
            }
            
            console.log('Completed races:', completedRaces);
            
            if (completedRaces.length < 2) {
                console.log(`Only ${completedRaces.length} completed races found, need at least 2 for position changes`);
                return { lastRace: null, previousRace: null };
            }
            
            const lastRace = completedRaces[completedRaces.length - 1];
            const previousRace = completedRaces[completedRaces.length - 2];
            
            console.log('Selected races for comparison:', { previousRace, lastRace });
            return { lastRace, previousRace };
            
        } catch (error) {
            console.error('Error detecting completed races:', error);
            return { lastRace: null, previousRace: null };
        }
    },

    // Load sheet data (same as your main script but isolated)
    async loadSheetData(sheetName) {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${this.CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
            console.log(`[PositionTracker] Loading: ${sheetName}`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const csvData = await response.text();
            
            if (csvData.includes('error') || csvData.includes('The requested sheet')) {
                throw new Error(`Sheet "${sheetName}" not found or inaccessible`);
            }
            
            return this.parseSheetData(csvData, sheetName);
        } catch (error) {
            console.error(`[PositionTracker] Error loading ${sheetName}:`, error);
            throw error;
        }
    },

    // Simple CSV parser for position tracking
    parseSheetData(csvData, sheetName) {
        if (!csvData || csvData.trim().length === 0) {
            return [];
        }
        
        const rows = csvData.split(/\r?\n/).filter(row => row.trim() !== '');
        if (rows.length < 1) return [];
        
        const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const data = [];
        
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cells.length < 2 || !cells[0]) continue;
            
            const item = this.parseRowBasedOnSheet(headers, cells, sheetName);
            if (item) data.push(item);
        }
        
        return data;
    },

    parseRowBasedOnSheet(headers, cells, sheetName) {
        const driverName = cells[0];
        if (!driverName) return null;

        if (sheetName === 'Championship Standings') {
            const racePoints = {};
            headers.forEach((header, index) => {
                if (index > 0 && index < headers.length - 2 && header.trim() && 
                    header !== 'Position' && header !== 'Total Points') {
                    racePoints[header] = parseInt(cells[index]) || 0;
                }
            });
            
            return {
                name: driverName,
                points: parseInt(cells[headers.length - 1]) || 0,
                racePoints: racePoints
            };
        }
        
        if (sheetName === 'Driver Ratings') {
            return {
                name: driverName,
                finalRating: parseFloat(cells[5]) || 0
            };
        }
        
        if (sheetName === 'Teammate Head to Head') {
            return {
                team: cells[0] || 'Unknown',
                driverName: cells[1] || 'Unknown Driver',
                teamPoints: parseInt(cells[6]) || 0
            };
        }
        
        return { name: driverName };
    },

    // Calculate all position changes
    async calculateAllChanges() {
        console.log('[PositionTracker] Calculating all position changes...');
        
        try {
            const driverChanges = await this.calculateDriverPositionChanges();
            const constructorChanges = await this.calculateConstructorPositionChanges();
            const ratingChanges = await this.calculateDriverRatingChanges();
            
            console.log('[PositionTracker] All changes calculated:', {
                driverChanges,
                constructorChanges, 
                ratingChanges
            });
            
            return {
                driverChanges,
                constructorChanges,
                ratingChanges
            };
        } catch (error) {
            console.error('[PositionTracker] Error calculating changes:', error);
            return {};
        }
    },

    // Calculate driver position changes
    async calculateDriverPositionChanges() {
        try {
            const { lastRace, previousRace } = await this.getLastTwoCompletedRaces();
            if (!lastRace || !previousRace) {
                console.log('[PositionTracker] Not enough races for driver changes');
                return {};
            }
            
            const standings = await this.loadSheetData('Championship Standings');
            if (!standings || standings.length === 0) {
                return {};
            }
            
            console.log(`[PositionTracker] Calculating driver changes: ${previousRace} -> ${lastRace}`);
            
            // Calculate cumulative standings for previous race
            const previousRaceStandings = standings
                .filter(driver => driver.name && driver.points !== undefined)
                .map(driver => {
                    let cumulativePoints = 0;
                    const raceNames = Object.keys(driver.racePoints || {});
                    const previousRaceIndex = raceNames.indexOf(previousRace);
                    
                    for (let i = 0; i <= previousRaceIndex; i++) {
                        cumulativePoints += driver.racePoints[raceNames[i]] || 0;
                    }
                    
                    return {
                        name: driver.name,
                        points: cumulativePoints
                    };
                })
                .sort((a, b) => b.points - a.points);
            
            // Calculate cumulative standings for last race  
            const lastRaceStandings = standings
                .filter(driver => driver.name && driver.points !== undefined)
                .map(driver => {
                    let cumulativePoints = 0;
                    const raceNames = Object.keys(driver.racePoints || {});
                    const lastRaceIndex = raceNames.indexOf(lastRace);
                    
                    for (let i = 0; i <= lastRaceIndex; i++) {
                        cumulativePoints += driver.racePoints[raceNames[i]] || 0;
                    }
                    
                    return {
                        name: driver.name,
                        points: cumulativePoints
                    };
                })
                .sort((a, b) => b.points - a.points);
            
            // Calculate position changes
            const positionChanges = {};
            const previousPositions = {};
            
            previousRaceStandings.forEach((driver, index) => {
                previousPositions[driver.name] = index + 1;
            });
            
            lastRaceStandings.forEach((driver, currentIndex) => {
                const currentPosition = currentIndex + 1;
                const previousPosition = previousPositions[driver.name];
                
                if (previousPosition !== undefined) {
                    positionChanges[driver.name] = previousPosition - currentPosition;
                } else {
                    positionChanges[driver.name] = 0;
                }
            });
            
            // Store changes
            localStorage.setItem('efc_driver_position_changes', JSON.stringify(positionChanges));
            localStorage.setItem('efc_last_race', lastRace);
            
            console.log('[PositionTracker] Driver changes calculated:', positionChanges);
            return positionChanges;
            
        } catch (error) {
            console.error('[PositionTracker] Error calculating driver changes:', error);
            return {};
        }
    },

    // Calculate constructor position changes
    async calculateConstructorPositionChanges() {
        try {
            const { lastRace, previousRace } = await this.getLastTwoCompletedRaces();
            if (!lastRace || !previousRace) {
                console.log('[PositionTracker] Not enough races for constructor changes');
                return {};
            }
            
            const teammateData = await this.loadSheetData('Teammate Head to Head');
            if (!teammateData || teammateData.length === 0) {
                return {};
            }
            
            // Group teams
            const teams = {};
            teammateData.forEach(driver => {
                if (driver.team && driver.team !== 'Unknown') {
                    if (!teams[driver.team]) {
                        teams[driver.team] = [];
                    }
                    teams[driver.team].push(driver);
                }
            });
            
            // For simplicity, use total team points for now
            // You can enhance this later with race-by-race team points
            const constructorChanges = {};
            
            console.log('[PositionTracker] Constructor changes calculated (basic version):', constructorChanges);
            localStorage.setItem('efc_constructor_position_changes', JSON.stringify(constructorChanges));
            
            return constructorChanges;
            
        } catch (error) {
            console.error('[PositionTracker] Error calculating constructor changes:', error);
            return {};
        }
    },

    // Calculate driver rating changes
    async calculateDriverRatingChanges() {
        try {
            const currentRatings = await this.loadSheetData('Driver Ratings');
            const storedPreviousRatings = localStorage.getItem('efc_previous_ratings');
            
            if (!storedPreviousRatings) {
                // Store current ratings as baseline
                const ratingBaseline = {};
                currentRatings.forEach(driver => {
                    if (driver.name && driver.finalRating) {
                        ratingBaseline[driver.name] = driver.finalRating;
                    }
                });
                localStorage.setItem('efc_previous_ratings', JSON.stringify(ratingBaseline));
                return {};
            }
            
            const previousRatings = JSON.parse(storedPreviousRatings);
            const ratingChanges = {};
            
            currentRatings.forEach(driver => {
                if (driver.name && driver.finalRating) {
                    const previousRating = previousRatings[driver.name];
                    if (previousRating !== undefined) {
                        ratingChanges[driver.name] = (driver.finalRating - previousRating).toFixed(1);
                    } else {
                        ratingChanges[driver.name] = "0.0";
                    }
                }
            });
            
            // Update stored ratings
            const newRatingBaseline = {};
            currentRatings.forEach(driver => {
                if (driver.name && driver.finalRating) {
                    newRatingBaseline[driver.name] = driver.finalRating;
                }
            });
            localStorage.setItem('efc_previous_ratings', JSON.stringify(newRatingBaseline));
            localStorage.setItem('efc_rating_changes', JSON.stringify(ratingChanges));
            
            console.log('[PositionTracker] Rating changes calculated:', ratingChanges);
            return ratingChanges;
            
        } catch (error) {
            console.error('[PositionTracker] Error calculating rating changes:', error);
            return {};
        }
    },

    // Get stored changes (to be called from your main display functions)
    getDriverPositionChanges() {
        try {
            const storedChanges = localStorage.getItem('efc_driver_position_changes');
            return storedChanges ? JSON.parse(storedChanges) : {};
        } catch (error) {
            console.error('[PositionTracker] Error getting driver changes:', error);
            return {};
        }
    },

    getConstructorPositionChanges() {
        try {
            const storedChanges = localStorage.getItem('efc_constructor_position_changes');
            return storedChanges ? JSON.parse(storedChanges) : {};
        } catch (error) {
            console.error('[PositionTracker] Error getting constructor changes:', error);
            return {};
        }
    },

    getDriverRatingChanges() {
        try {
            const storedChanges = localStorage.getItem('efc_rating_changes');
            return storedChanges ? JSON.parse(storedChanges) : {};
        } catch (error) {
            console.error('[PositionTracker] Error getting rating changes:', error);
            return {};
        }
    },

    // Force refresh all changes
    async refreshAllChanges() {
        console.log('[PositionTracker] Manually refreshing all changes...');
        return await this.calculateAllChanges();
    },

    // Reset all stored changes
    resetAllChanges() {
        localStorage.removeItem('efc_driver_position_changes');
        localStorage.removeItem('efc_constructor_position_changes');
        localStorage.removeItem('efc_rating_changes');
        localStorage.removeItem('efc_last_race');
        localStorage.removeItem('efc_previous_ratings');
        console.log('[PositionTracker] All changes reset');
    }
};

// Auto-initialize when loaded
PositionTracker.init();

// Make available globally
window.PositionTracker = PositionTracker;