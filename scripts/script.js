// ===== CONFIGURATION =====
const CONFIG = {
    SHEET_ID: '1bAxn0H6xgi81Ms7c6TuRI1SdCssQDaajb0JwCkKS1gw',
};

// Global team mapping that will be loaded from Google Sheets
let TEAM_MAPPING = {};

// ===== IMPROVED POSITION TRACKING =====
async function getLastTwoCompletedRaces() {
    try {
        const standings = await loadSheetData('Championship Standings');
        if (!standings || standings.length === 0) {
            console.log('No standings data found');
            return { lastRace: null, previousRace: null };
        }
        
        // Find a driver with race points data
        const sampleDriver = standings.find(driver => driver.racePoints && Object.keys(driver.racePoints).length > 0);
        if (!sampleDriver) {
            console.log('No driver with race points found');
            return { lastRace: null, previousRace: null };
        }
        
        const allRaceNames = Object.keys(sampleDriver.racePoints);
        console.log('All race names found:', allRaceNames);
        
        // Find completed races (non-zero points for any driver)
        const completedRaces = [];
        
        for (const race of allRaceNames) {
            const hasNonZeroPoints = standings.some(driver => {
                const points = driver.racePoints && driver.racePoints[race];
                return points !== undefined && points !== null && points > 0;
            });
            
            if (hasNonZeroPoints) {
                completedRaces.push(race);
                console.log(`Race "${race}" has points data`);
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
}

async function calculatePositionChangesFromStandings() {
    try {
        console.log('=== CALCULATING POSITION CHANGES ===');
        
        const { lastRace, previousRace } = await getLastTwoCompletedRaces();
        if (!lastRace || !previousRace) {
            console.log('Not enough completed races for position changes');
            return {};
        }
        
        const standings = await loadSheetData('Championship Standings');
        if (!standings || standings.length === 0) {
            console.log('No standings data available');
            return {};
        }
        
        console.log(`Calculating changes between: ${previousRace} -> ${lastRace}`);
        
        // Calculate positions after previous race (cumulative points up to previous race)
        const previousRaceStandings = standings
            .filter(driver => driver.name && driver.points !== undefined)
            .map(driver => {
                // Calculate cumulative points up to the previous race
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
        
        // Calculate positions after last race (cumulative points up to last race)  
        const lastRaceStandings = standings
            .filter(driver => driver.name && driver.points !== undefined)
            .map(driver => {
                // Calculate cumulative points up to the last race
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
        
        console.log('Previous race standings:', previousRaceStandings.map(d => `${d.name}: ${d.points}`));
        console.log('Last race standings:', lastRaceStandings.map(d => `${d.name}: ${d.points}`));
        
        // Calculate position changes
        const positionChanges = {};
        const previousPositions = {};
        
        // Map driver names to their positions in previous race
        previousRaceStandings.forEach((driver, index) => {
            previousPositions[driver.name] = index + 1;
        });
        
        // Calculate changes for current standings
        lastRaceStandings.forEach((driver, currentIndex) => {
            const currentPosition = currentIndex + 1;
            const previousPosition = previousPositions[driver.name];
            
            if (previousPosition !== undefined) {
                positionChanges[driver.name] = previousPosition - currentPosition;
                console.log(`${driver.name}: ${previousPosition} -> ${currentPosition} = ${positionChanges[driver.name]}`);
            } else {
                // Driver wasn't in previous standings (new driver)
                positionChanges[driver.name] = 0;
                console.log(`${driver.name}: New driver, no previous position`);
            }
        });
        
        // Store the position changes
        localStorage.setItem('efc_position_changes', JSON.stringify(positionChanges));
        localStorage.setItem('efc_last_race', lastRace);
        
        console.log('Final position changes stored:', positionChanges);
        return positionChanges;
        
    } catch (error) {
        console.error('Error calculating position changes:', error);
        return {};
    }
}

async function loadPositionChanges() {
    try {
        const storedChanges = localStorage.getItem('efc_position_changes');
        const storedRace = localStorage.getItem('efc_last_race');
        
        if (storedChanges && storedRace) {
            console.log('Loading stored position changes for race:', storedRace);
            const changes = JSON.parse(storedChanges);
            console.log('Stored changes:', changes);
            return changes;
        }
        
        // If no stored changes, calculate them fresh
        console.log('No stored position changes, calculating fresh...');
        return await calculatePositionChangesFromStandings();
        
    } catch (error) {
        console.error('Error loading position changes:', error);
        return {};
    }
}

// ===== GOOGLE SHEETS INTEGRATION =====
async function loadSheetData(sheetName) {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
        console.log(`Loading: ${sheetName}`);
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Sheet "${sheetName}" not found (404). Check if the sheet name is correct.`);
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const csvData = await response.text();
        
        // Check if the sheet exists and has data
        if (csvData.includes('error') || csvData.includes('The requested sheet')) {
            throw new Error(`Sheet "${sheetName}" not found or inaccessible`);
        }
        
        return parseSheetData(csvData, sheetName);
    } catch (error) {
        console.error(`Error loading ${sheetName}:`, error);
        throw error;
    }
}

// Load team mapping from Google Sheets
async function loadTeamMapping() {
    try {
        console.log('Loading team mapping from Google Sheets...');
        const teamData = await loadSheetData('Teams');
        
        // Build team mapping from the Teams sheet
        TEAM_MAPPING = {};
        teamData.forEach(row => {
            if (row.driverName && row.team) {
                const lookupName = row.driverName.includes(' (') ? 
                    row.driverName.split(' (')[0] : row.driverName;
                TEAM_MAPPING[lookupName] = row.team;
            }
        });
        
        console.log('Team mapping loaded:', TEAM_MAPPING);
        return TEAM_MAPPING;
    } catch (error) {
        console.error('Error loading team mapping:', error);
        return {};
    }
}

// ===== DATA PARSING =====
function parseSheetData(csvData, sheetName) {
    if (!csvData || csvData.trim().length === 0) {
        console.warn(`Empty CSV data for ${sheetName}`);
        return [];
    }
    
    const rows = csvData.split(/\r?\n/).filter(row => row.trim() !== '');
    if (rows.length < 1) {
        console.warn(`No rows found in ${sheetName}`);
        return [];
    }
    
    const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];
    
    console.log(`Parsing ${sheetName} with ${rows.length} rows, headers:`, headers);
    
    // Special handling for different sheet structures
    if (sheetName === 'Race Results') {
        const raceHeaders = rows.length > 1 ? rows[1].split(',').map(h => h.trim().replace(/^"|"$/g, '')) : headers;
        const startRow = rows.length > 2 ? 2 : 1;
        for (let i = startRow; i < rows.length; i++) {
            const cells = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cells.length < 2 || !cells[0]) continue;
            
            const item = parseRowBasedOnSheet(raceHeaders, cells, sheetName);
            if (item) data.push(item);
        }
    } else if (sheetName === 'Overall Rating') {
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cells.length < 6 || !cells[0] || cells[0] === 'Driver' || cells[0].includes('COMPUTED_VALUE')) continue;
            
            const driverName = cells[0];
            const points = parseInt(cells[1]) || 0;
            
            if (driverName && points > 0) {
                const lookupName = driverName.includes(' (') ? driverName.split(' (')[0] : driverName;
                const item = {
                    name: driverName,
                    originalName: driverName,
                    lookupName: lookupName,
                    team: TEAM_MAPPING[lookupName] || 'Unknown',
                    points: points,
                    rating: 0
                };
                data.push(item);
            }
        }
        
        // Find ratings from columns D-E
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cells.length < 5 || !cells[3] || cells[3] === 'Driver' || cells[3].includes('COMPUTED_VALUE')) continue;
            
            const driverName = cells[3];
            const rating = parseFloat(cells[4]) || 0;
            const lookupName = driverName.includes(' (') ? driverName.split(' (')[0] : driverName;
            
            const existingDriver = data.find(d => d.lookupName === lookupName);
            if (existingDriver && rating > 0) {
                existingDriver.rating = rating;
            }
        }
    } else if (sheetName === 'Teams') {
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cells.length < 2 || !cells[0] || !cells[1]) continue;
            
            const item = {
                driverName: cells[0],
                team: cells[1],
            };
            data.push(item);
        }
    } else if (sheetName === 'Teammate Head to Head') {
        console.log('Processing Teammate Head to Head with structure:', headers);
        
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cells.length < 2 || !cells[0] || !cells[1]) continue;
            
            const item = {
                team: cells[0] || 'Unknown',
                driverName: cells[1] || 'Unknown Driver',
                points: parseInt(cells[2]) || 0,
                avgQuali: parseFloat(cells[3]) || 0,
                driverRating: parseFloat(cells[4]) || 0,
                podiums: parseInt(cells[5]) || 0,
                teamPoints: parseInt(cells[6]) || 0,
                teamRating: parseFloat(cells[7]) || 0,
                avgFinish: parseFloat(cells[8]) || 0
            };
            
            const lookupName = item.driverName.includes(' (') ? 
                item.driverName.split(' (')[0] : item.driverName;
            item.lookupName = lookupName;
            item.team = TEAM_MAPPING[lookupName] || item.team;
            
            data.push(item);
        }
    } else if (sheetName === 'Quali Results' || sheetName === 'Race Results') {
        console.log(`Processing ${sheetName} with structure:`, headers);
        
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cells.length < 2 || !cells[0]) continue;
            
            const item = parseRowBasedOnSheet(headers, cells, sheetName);
            if (item) {
                data.push(item);
            }
        }
    } else {
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (cells.length < 2 || !cells[0]) continue;
            
            const item = parseRowBasedOnSheet(headers, cells, sheetName);
            if (item) data.push(item);
        }
    }
    
    console.log(`Parsed ${data.length} items from ${sheetName}`);
    return data;
}

function parseRowBasedOnSheet(headers, cells, sheetName) {
    let driverName = cells[0];
    let originalName = driverName;
    
    let lookupName = driverName;
    if (driverName.includes(' (')) {
        lookupName = driverName.split(' (')[0];
    }
    
    let team = TEAM_MAPPING[lookupName] || 'Unknown';
    
    if (team === 'Unknown' && driverName.includes(' (')) {
        const teamMatch = driverName.match(/\((.*?)\)/);
        if (teamMatch && teamMatch[1]) {
            team = teamMatch[1];
        }
    }
    
    const baseItem = {
        name: driverName,
        originalName: originalName,
        lookupName: lookupName,
        team: team
    };
    
    switch(sheetName) {
        case 'Overall Rating':
            return {
                ...baseItem,
                points: parseInt(cells[1]) || 0,
                rating: parseFloat(cells[4]) || 0
            };
            
        case 'Championship Standings':
            const racePoints = {};
            const raceNames = [];
            
            headers.forEach((header, index) => {
                if (index > 0 && index < headers.length - 2 && header.trim() && 
                    header !== 'Position' && header !== 'Total Points') {
                    racePoints[header] = parseInt(cells[index]) || 0;
                    raceNames.push(header);
                }
            });
            
            return {
                ...baseItem,
                points: parseInt(cells[headers.length - 1]) || 0,
                position: parseInt(cells[headers.length - 2]) || 0,
                racePoints: racePoints,
                raceNames: raceNames
            };
            
        case 'Driver Ratings':
            return {
                ...baseItem,
                races: cells[1] || '0',
                avgFinish: parseFloat(cells[2]) || 0,
                avgQuali: parseFloat(cells[3]) || 0,
                performance: parseFloat(cells[4]) || 0,
                finalRating: parseFloat(cells[5]) || 0
            };
            
        case 'Teammate Head to Head':
            return null;
            
        case 'Full Driver Stats':
            return {
                ...baseItem,
                races: cells[1] || '0',
                points: parseInt(cells[2]) || 0,
                pointsPerRace: parseFloat(cells[3]) || 0,
                avgFinish: parseFloat(cells[4]) || 0,
                avgQuali: parseFloat(cells[5]) || 0,
                wins: parseInt(cells[6]) || 0,
                podiums: parseInt(cells[7]) || 0,
                poles: parseInt(cells[8]) || 0,
                driverRating: parseFloat(cells[9]) || 0,
                consistency: parseFloat(cells[10]) || 0,
                fastestLaps: parseInt(cells[11]) || 0,
                highestFinish: cells[12] || '-',
                avgPosChange: parseFloat(cells[13]) || 0,
                podiumRate: parseFloat(cells[14]) || 0,
                championships: parseInt(cells[15]) || 0
            };
            
        case 'Race Results':
        case 'Quali Results':
            const results = {};
            headers.forEach((header, index) => {
                if (index > 0 && header.trim() && header !== 'X' && header !== 'Completed?') {
                    results[header] = cells[index] || '';
                }
            });
            
            return {
                ...baseItem,
                results: results
            };
            
        default:
            return baseItem;
    }
}

// ===== DISPLAY FUNCTIONS =====
function displayData(data, sheetName) {
    const container = document.getElementById('standings-container');
    
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="loading">
                No data available for ${sheetName}. 
                <br><small>This sheet might be empty or have different structure.</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    try {
        switch(sheetName) {
            case 'Overall Rating':
                displayOverallRating(data, container);
                break;
            case 'Championship Standings':
                displayChampionshipStandings(data, container);
                break;
            case 'Driver Ratings':
                displayDriverRatings(data, container);
                break;
            case 'Teammate Head to Head':
                displayTeammateH2H(data, container);
                break;
            case 'Full Driver Stats':
                displayFullStats(data, container);
                break;
            case 'Race Results':
                displayRaceResults(data, container, sheetName);
                break;
            case 'Quali Results':
                displayQualiResults(data, container, sheetName);
                break;
                
            // NEW CASES ADDED HERE:
            case 'Race Calendar':
                if (window.raceCalendar) {
                    window.raceCalendar.displayFullCalendar();
                } else {
                    container.innerHTML = '<div class="loading">Loading Race Calendar...</div>';
                    setTimeout(() => {
                        window.raceCalendar = new RaceCalendar();
                        window.raceCalendar.displayFullCalendar();
                    }, 100);
                }
                break;
                
            case 'Circuit Maps':
                if (window.circuitMaps) {
                    window.circuitMaps.displayCircuitSelector();
                } else {
                    container.innerHTML = '<div class="loading">Circuit Maps loading...</div>';
                    setTimeout(() => {
                        window.circuitMaps.displayCircuitSelector();
                    }, 100);
                }
                break;
                
            case 'EFC News':
                displayEFCNews(container);
                break;
                
            default:
                container.innerHTML = `<div class="loading">Display for ${sheetName} not implemented</div>`;
        }
    } catch (error) {
        console.error(`Error displaying ${sheetName}:`, error);
        container.innerHTML = `
            <div class="error">
                Error displaying ${sheetName}: ${error.message}
                <br><small>Check console for details</small>
            </div>
        `;
    }
    
    updateLastUpdated();
}

async function displayOverallRating(ratings, container) {
    console.log('Overall Rating data:', ratings);
    
    // Filter out drivers with no points and sort by points (descending)
    const validRatings = ratings.filter(driver => driver.points > 0 && driver.name);
    validRatings.sort((a, b) => (b.points || 0) - (a.points || 0));
    
    // Load position changes - THIS IS THE KEY FIX
    const positionChanges = await loadPositionChanges();
    console.log('Position changes for display:', positionChanges);
    
    validRatings.forEach((driver, index) => {
        const position = index + 1;
        const teamClass = `team-${driver.team.replace(/\s+/g, '-')}`;
        const podiumClass = position <= 3 ? `podium-${position}` : '';
        
        // Get position change indicator
        const change = positionChanges[driver.name] || 0;
        let changeIndicator = '';
        
        if (change > 0) {
            changeIndicator = `<span class="position-up">▲${change}</span>`;
        } else if (change < 0) {
            changeIndicator = `<span class="position-down">▼${Math.abs(change)}</span>`;
        } else if (Object.keys(positionChanges).length > 0) {
            changeIndicator = `<span class="position-same">-</span>`;
        }
        
        console.log(`Driver: ${driver.name}, Position: ${position}, Change: ${change}, Indicator: ${changeIndicator}`);
        
        const row = document.createElement('div');
        row.className = `driver-row ${podiumClass}`;
        row.innerHTML = `
            <div class="position position-${position}">${position}</div>
            <div class="driver-info">
                <div class="driver-name ${teamClass}">${driver.name} ${changeIndicator}</div>
                <div class="team-name ${teamClass}">${driver.team.toUpperCase()}</div>
            </div>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${(driver.rating || 0).toFixed(1)}</div>
                    <div class="stat-label">RATING</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${driver.points || 0}</div>
                    <div class="stat-label">PTS</div>
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

function displayChampionshipStandings(standings, container) {
    console.log('Championship Standings data:', standings);
    
    const validStandings = standings.filter(driver => driver.points > 0 || driver.name);
    
    const activeSubTab = document.querySelector('.sub-tab.active');
    if (activeSubTab && activeSubTab.dataset.type === 'constructors') {
        displayConstructorsStandings(validStandings, container);
    } else {
        const sortedStandings = [...validStandings].sort((a, b) => (b.points || 0) - (a.points || 0));
        displayChampionshipProgression(sortedStandings, container);
    }
}

function displayConstructorsStandings(standings, container) {
    loadSheetData('Teammate Head to Head').then(teammateData => {
        const constructorPoints = {};
        const constructorDrivers = {};
        
        teammateData.forEach(driver => {
            if (driver.team && driver.teamPoints) {
                constructorPoints[driver.team] = driver.teamPoints;
                if (!constructorDrivers[driver.team]) {
                    constructorDrivers[driver.team] = [];
                }
                constructorDrivers[driver.team].push(driver.driverName);
            }
        });
        
        const constructors = Object.keys(constructorPoints).map(team => ({
            team: team,
            points: constructorPoints[team] || 0,
            drivers: constructorDrivers[team] || []
        })).sort((a, b) => b.points - a.points);
        
        constructors.forEach((constructor, index) => {
            const position = index + 1;
            const teamClass = `team-${constructor.team.replace(/\s+/g, '-')}`;
            const podiumClass = position <= 3 ? `podium-${position}` : '';
            
            const row = document.createElement('div');
            row.className = `constructor-row ${podiumClass}`;
            
            const driverNames = constructor.drivers.map(driver => {
                return driver.split(' (')[0];
            }).join(', ');
            
            row.innerHTML = `
                <div class="position position-${position}">${position}</div>
                <div class="constructor-info">
                    <div class="constructor-name ${teamClass}">${constructor.team}</div>
                    <div class="constructor-points ${teamClass}">${driverNames}</div>
                </div>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-value">${constructor.points || 0}</div>
                        <div class="stat-label">PTS</div>
                    </div>
                </div>
            `;
            container.appendChild(row);
        });
    }).catch(error => {
        container.innerHTML = `<div class="error">Error loading constructor standings: ${error.message}</div>`;
    });
}

function displayChampionshipProgression(standings, container) {
    if (!standings[0] || !standings[0].racePoints) return;
    
    const progressionContainer = document.createElement('div');
    progressionContainer.className = 'championship-progression';
    progressionContainer.innerHTML = '<h3>Championship Standings - Points Progression</h3>';
    
    const sampleDriver = standings.find(d => d.racePoints && Object.keys(d.racePoints).length > 0);
    if (!sampleDriver) return;
    
    const allRaceNames = Object.keys(sampleDriver.racePoints);
    let lastCompletedRaceIndex = -1;
    
    for (let i = 0; i < allRaceNames.length; i++) {
        const race = allRaceNames[i];
        const hasPoints = standings.some(driver => driver.racePoints[race] > 0);
        if (hasPoints) {
            lastCompletedRaceIndex = i;
        }
    }
    
    const completedRaces = allRaceNames.slice(0, lastCompletedRaceIndex + 1);
    const futureRaces = allRaceNames.slice(lastCompletedRaceIndex + 1);
    
    if (completedRaces.length === 0) return;
    
    const table = document.createElement('table');
    table.className = 'progression-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th class="progression-driver">Driver</th>
            ${completedRaces.map(race => `<th>${race}</th>`).join('')}
            ${futureRaces.map(race => `<th class="future-race">${race}</th>`).join('')}
            <th style="background: #444; font-weight: bold;">Total</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    
    standings.forEach(driver => {
        const teamClass = `team-${driver.team.replace(/\s+/g, '-')}`;
        const row = document.createElement('tr');
        
        let cumulativePoints = 0;
        const cumulativePointsByRace = completedRaces.map(race => {
            cumulativePoints += driver.racePoints[race] || 0;
            return cumulativePoints;
        });
        
        const finalPoints = cumulativePointsByRace.length > 0 ? 
            cumulativePointsByRace[cumulativePointsByRace.length - 1] : 0;
        
        row.innerHTML = `
            <td class="progression-driver">
                <span class="${teamClass}">${driver.name}</span>
            </td>
            ${cumulativePointsByRace.map(points => `
                <td class="completed-race">${points}</td>
            `).join('')}
            ${futureRaces.map(() => `
                <td class="future-race">0</td>
            `).join('')}
            <td style="background: #2a2a2a; font-weight: bold;">${finalPoints}</td>
        `;
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    progressionContainer.appendChild(table);
    container.appendChild(progressionContainer);
}

// ... (Other display functions remain the same as your original)
function displayDriverRatings(ratings, container) {
    const validRatings = ratings.filter(driver => driver.finalRating > 0 && driver.name);
    validRatings.sort((a, b) => (b.finalRating || 0) - (a.finalRating || 0));
    
    validRatings.forEach((driver, index) => {
        const position = index + 1;
        const teamClass = `team-${driver.team.replace(/\s+/g, '-')}`;
        const podiumClass = position <= 3 ? `podium-${position}` : '';
        
        const row = document.createElement('div');
        row.className = `driver-row ${podiumClass}`;
        row.innerHTML = `
            <div class="position position-${position}">${position}</div>
            <div class="driver-info">
                <div class="driver-name ${teamClass}">${driver.name}</div>
                <div class="team-name ${teamClass}">RACES ATTENDED: ${driver.races}</div>
            </div>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${(driver.finalRating || 0).toFixed(1)}</div>
                    <div class="stat-label">RATING</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${(driver.performance || 0).toFixed(1)}</div>
                    <div class="stat-label">PERFORMANCE</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${(driver.avgFinish || 0).toFixed(1)}</div>
                    <div class="stat-label">AVG FIN</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${(driver.avgQuali || 0).toFixed(1)}</div>
                    <div class="stat-label">AVG QUALI</div>
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

function displayTeammateH2H(teams, container) {
    console.log('Teammate H2H data:', teams);
    
    const teamsGrouped = {};
    teams.forEach(driver => {
        if (driver.team && driver.driverName && driver.team !== 'Unknown') {
            if (!teamsGrouped[driver.team]) {
                teamsGrouped[driver.team] = [];
            }
            teamsGrouped[driver.team].push(driver);
        }
    });
    
    const sortedTeams = Object.keys(teamsGrouped).sort((a, b) => {
        const teamAPoints = teamsGrouped[a][0]?.teamPoints || 0;
        const teamBPoints = teamsGrouped[b][0]?.teamPoints || 0;
        return teamBPoints - teamAPoints;
    });
    
    sortedTeams.forEach(teamName => {
        const teamDrivers = teamsGrouped[teamName];
        
        const teamHeader = document.createElement('div');
        teamHeader.className = 'driver-row';
        teamHeader.style.background = '#333';
        const teamClass = `team-${teamName.replace(/\s+/g, '-')}`;
        
        const driverNames = teamDrivers.map(d => d.driverName).join(' vs ');
        const teamPoints = teamDrivers[0]?.teamPoints || teamDrivers.reduce((sum, driver) => sum + (driver.points || 0), 0);
        
        teamHeader.innerHTML = `
            <div class="position"></div>
            <div class="driver-info">
                <div class="driver-name ${teamClass}">${teamName}</div>
                <div class="team-name ${teamClass}">${driverNames} • ${teamPoints} PTS</div>
            </div>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${(teamDrivers[0]?.teamRating || 0).toFixed(1)}</div>
                    <div class="stat-label">TEAM RATING</div>
                </div>
            </div>
        `;
        container.appendChild(teamHeader);
        
        teamDrivers.forEach(driver => {
            const row = document.createElement('div');
            row.className = `driver-row`;
            const driverTeamClass = `team-${driver.team.replace(/\s+/g, '-')}`;
            
            row.innerHTML = `
                <div class="position"></div>
                <div class="driver-info">
                    <div class="driver-name ${driverTeamClass}">${driver.driverName}</div>
                    <div class="team-name ${driverTeamClass}">${driver.team}</div>
                </div>
                <div class="stats">
                    <div class="stat">
                        <div class="stat-value">${driver.points || 0}</div>
                        <div class="stat-label">PTS</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${(driver.avgQuali || 0).toFixed(1)}</div>
                        <div class="stat-label">QUALI</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${(driver.avgFinish || 0).toFixed(1)}</div>
                        <div class="stat-label">AVG FIN</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${(driver.driverRating || 0).toFixed(1)}</div>
                        <div class="stat-label">RATING</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${driver.podiums || 0}</div>
                        <div class="stat-label">PODIUMS</div>
                    </div>
                </div>
            `;
            container.appendChild(row);
        });
        
        const spacer = document.createElement('div');
        spacer.style.height = '10px';
        container.appendChild(spacer);
    });
    
    if (sortedTeams.length === 0) {
        container.innerHTML = `
            <div class="error">
                No team data found. 
                <br><small>Check the Teammate Head to Head sheet structure.</small>
            </div>
        `;
    }
}

function displayFullStats(stats, container) {
    const validStats = stats.filter(driver => driver.points > 0 || driver.name);
    validStats.sort((a, b) => (b.points || 0) - (a.points || 0));
    
    const table = document.createElement('table');
    table.className = 'full-stats-table';
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Pos</th>
            <th>Driver</th>
            <th>Team</th>
            <th>Races</th>
            <th>Points</th>
            <th>Pts/Race</th>
            <th>Avg Finish</th>
            <th>Avg Quali</th>
            <th>Wins</th>
            <th>Podiums</th>
            <th>Poles</th>
            <th>Rating</th>
            <th>Consistency</th>
            <th>Fast Laps</th>
            <th>Best Finish</th>
            <th>Pos Change</th>
            <th>Podium %</th>
            <th>Championships</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    validStats.forEach((driver, index) => {
        const position = index + 1;
        const teamClass = `team-${driver.team.replace(/\s+/g, '-')}`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="position-${position}">${position}</td>
            <td><span class="${teamClass}">${driver.name}</span></td>
            <td>${driver.team}</td>
            <td>${driver.races || 0}</td>
            <td>${driver.points || 0}</td>
            <td>${(driver.pointsPerRace || 0).toFixed(1)}</td>
            <td>${(driver.avgFinish || 0).toFixed(1)}</td>
            <td>${(driver.avgQuali || 0).toFixed(1)}</td>
            <td>${driver.wins || 0}</td>
            <td>${driver.podiums || 0}</td>
            <td>${driver.poles || 0}</td>
            <td>${(driver.driverRating || 0).toFixed(1)}</td>
            <td>${(driver.consistency || 0).toFixed(1)}</td>
            <td>${driver.fastestLaps || 0}</td>
            <td>${driver.highestFinish || '-'}</td>
            <td>${(driver.avgPosChange || 0).toFixed(1)}</td>
            <td>${(driver.podiumRate || 0).toFixed(1)}%</td>
            <td>${driver.championships || 0}</td>
        `;
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
}

function displayRaceResults(results, container, sheetName) {
    if (results.length === 0) {
        container.innerHTML = '<div class="loading">No race results data available</div>';
        return;
    }
    
    const firstDriver = results.find(driver => driver.results && Object.keys(driver.results).length > 0);
    if (!firstDriver) {
        container.innerHTML = '<div class="loading">No race results data available</div>';
        return;
    }
    
    const raceNames = Object.keys(firstDriver.results).filter(race => {
        return race && race !== 'X' && race !== 'Completed?' && race.trim() !== '';
    });
    
    if (raceNames.length === 0) {
        container.innerHTML = '<div class="loading">No completed races found</div>';
        return;
    }
    
    const header = document.createElement('div');
    header.className = 'race-header';
    header.innerHTML = `
        <div class="race-driver">DRIVER</div>
        ${raceNames.map(race => `<div class="race-result">${race}</div>`).join('')}
    `;
    container.appendChild(header);
    
    results.forEach(driver => {
        if (!driver.name) return;
        
        const row = document.createElement('div');
        row.className = 'race-row';
        const teamClass = `team-${driver.team.replace(/\s+/g, '-')}`;
        
        row.innerHTML = `
            <div class="race-driver">
                <div class="driver-name ${teamClass}" style="font-size: 14px;">${driver.name}</div>
                <div class="team-name ${teamClass}" style="font-size: 11px;">${driver.team}</div>
            </div>
            ${raceNames.map(race => {
                let result = driver.results[race] || '-';
                let positionClass = '';
                let fastestLapClass = '';
                
                const hasFastestLap = result.includes('Fastest Lap');
                if (hasFastestLap) {
                    fastestLapClass = 'fastest-lap';
                    result = result.replace(' (Fastest Lap)', '');
                }
                
                if (result === 'P1' || result === '1') {
                    positionClass = 'position-1';
                } else if (result === 'P2' || result === '2') {
                    positionClass = 'position-2';
                } else if (result === 'P3' || result === '3') {
                    positionClass = 'position-3';
                }
                
                return `
                    <div class="race-result ${fastestLapClass}">
                        <div class="stat-value ${positionClass}" style="font-size: 13px;">${result}</div>
                    </div>
                `;
            }).join('')}
        `;
        container.appendChild(row);
    });
}

function displayQualiResults(results, container, sheetName) {
    if (results.length === 0) {
        container.innerHTML = '<div class="loading">No quali results data available</div>';
        return;
    }
    
    const firstDriver = results.find(driver => driver.results && Object.keys(driver.results).length > 0);
    if (!firstDriver) {
        container.innerHTML = '<div class="loading">No quali results data available</div>';
        return;
    }
    
    const qualiNames = Object.keys(firstDriver.results).filter(quali => {
        return quali && quali !== 'X' && quali !== 'Completed?' && quali.trim() !== '';
    });
    
    if (qualiNames.length === 0) {
        container.innerHTML = '<div class="loading">No completed qualifying sessions found</div>';
        return;
    }
    
    const header = document.createElement('div');
    header.className = 'race-header';
    header.innerHTML = `
        <div class="race-driver">DRIVER</div>
        ${qualiNames.map(quali => `<div class="race-result">${quali}</div>`).join('')}
    `;
    container.appendChild(header);
    
    results.forEach(driver => {
        if (!driver.name) return;
        
        const row = document.createElement('div');
        row.className = 'race-row';
        const teamClass = `team-${driver.team.replace(/\s+/g, '-')}`;
        
        row.innerHTML = `
            <div class="race-driver">
                <div class="driver-name ${teamClass}" style="font-size: 14px;">${driver.name}</div>
                <div class="team-name ${teamClass}" style="font-size: 11px;">${driver.team}</div>
            </div>
            ${qualiNames.map(quali => {
                const result = driver.results[quali] || '-';
                let positionClass = '';
                if (result === 'P1' || result === '1') positionClass = 'position-1';
                else if (result === 'P2' || result === '2') positionClass = 'position-2';
                else if (result === 'P3' || result === '3') positionClass = 'position-3';
                
                return `
                    <div class="race-result">
                        <div class="stat-value ${positionClass}" style="font-size: 13px;">${result}</div>
                    </div>
                `;
            }).join('')}
        `;
        container.appendChild(row);
    });
}

function updateLastUpdated() {
    document.getElementById('last-updated').textContent = 
        `Last updated: ${new Date().toLocaleTimeString()}`;
}

// ===== TAB MANAGEMENT =====
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const sheetName = tab.dataset.sheet;
            
            const subTabs = document.getElementById('championship-subtabs');
            if (sheetName === 'Championship Standings') {
                subTabs.style.display = 'flex';
            } else {
                subTabs.style.display = 'none';
            }
            
            await loadAndDisplayData(sheetName);
        });
    });

    const subTabs = document.querySelectorAll('.sub-tab');
    subTabs.forEach(subTab => {
        subTab.addEventListener('click', async () => {
            const activeMainTab = document.querySelector('.tab.active');
            if (activeMainTab && activeMainTab.dataset.sheet === 'Championship Standings') {
                subTabs.forEach(t => t.classList.remove('active'));
                subTab.classList.add('active');
                await loadAndDisplayData('Championship Standings');
            }
        });
    });
}

async function loadAndDisplayData(sheetName) {
    try {
        document.getElementById('standings-container').innerHTML = '<div class="loading">Loading...</div>';
        const data = await loadSheetData(sheetName);

        // Ensure team mapping is loaded and applied
        if (Object.keys(TEAM_MAPPING).length === 0) {
            await loadTeamMapping();
        }
        
        // Update team information for all data items
        data.forEach(item => {
            if (item.lookupName && TEAM_MAPPING[item.lookupName]) {
                item.team = TEAM_MAPPING[item.lookupName];
            } else if (item.name && TEAM_MAPPING[item.name]) {
                item.team = TEAM_MAPPING[item.name];
            } else {
                item.team = 'Unknown';
            }
        });
        
        displayData(data, sheetName);
    } catch (error) {
        console.error(`Error in loadAndDisplayData for ${sheetName}:`, error);
        document.getElementById('standings-container').innerHTML = 
            `<div class="error">
                Error loading ${sheetName}: ${error.message}
                <br><small>Check that the sheet exists and is published in Google Sheets</small>
            </div>`;
    }
}

// Refresh function
async function refreshData() {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        await loadAndDisplayData(activeTab.dataset.sheet);
    }
}

// Debug function to check all sheets
async function debugAllSheets() {
    const sheets = ['Overall Rating', 'Championship Standings', 'Driver Ratings', 
                   'Teammate Head to Head', 'Full Driver Stats', 'Race Results', 'Quali Results', 'Teams'];
    
    for (const sheet of sheets) {
        try {
            const data = await loadSheetData(sheet);
            console.log(`✅ ${sheet}:`, data.length, 'items');
        } catch (error) {
            console.error(`❌ ${sheet}:`, error.message);
        }
    }
}

// Reset standings function
function resetStandings() {
    localStorage.removeItem('efc_position_changes');
    localStorage.removeItem('efc_last_race');
    console.log('Position changes data reset');
    refreshData();
}

// Add debug button for testing

// Add this helper function to make loadSheetData available globally
window.getRaceResultsData = async function() {
    try {
        return await loadSheetData('Race Results');
    } catch (error) {
        console.error('Error getting race results:', error);
        return null;
    }
};

// ===== INITIALIZATION =====
// ===== INITIALIZATION =====
async function initialize() {
    try {
        // Load team mapping first and wait for it to complete
        await loadTeamMapping();
        setupTabs();

        // AUTO-LOAD THE INITIAL ACTIVE TAB DATA
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            await loadAndDisplayData(activeTab.dataset.sheet);
        }
        
    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('standings-container').innerHTML = 
            `<div class="error">Failed to initialize: ${error.message}</div>`;
    }
}
// Start the application
initialize();

// Make debug function available globally
window.debugAllSheets = debugAllSheets;
window.debugTeamMapping = () => console.log('TEAM_MAPPING:', TEAM_MAPPING);
window.resetStandings = resetStandings;

// ===== POSITION TRACKING HELPERS =====
// Add these functions to your existing script.js

async function loadDriverPositionChanges() {
    return PositionTracker.getDriverPositionChanges();
}

async function loadConstructorPositionChanges() {
    return PositionTracker.getConstructorPositionChanges();
}

async function loadDriverRatingChanges() {
    return PositionTracker.getDriverRatingChanges();
}

// Update your reset function to include:
function resetStandings() {
    PositionTracker.resetAllChanges();
    console.log('Position changes data reset');
    refreshData();
}
// Helper function for race calendar to access race results data
window.getRaceResultsData = async function() {
    try {
        return await loadSheetData('Race Results');
    } catch (error) {
        console.error('Error getting race results:', error);
        return null;
    }
};

function updateRaceCountdown() {
    const header = document.querySelector('.header');
    if (!header || !window.raceCalendar || !window.raceCalendar.nextRace) return;

    // Remove existing countdown
    const existingCountdown = document.querySelector('.countdown-timer');
    if (existingCountdown) {
        existingCountdown.remove();
    }

    const nextRace = window.raceCalendar.nextRace;
    const circuitData = window.raceCalendar.circuitData ? window.raceCalendar.circuitData[nextRace.name] : null;
    
    // Get the base date from the race
    let raceDateTime = new Date(nextRace.date);
    
    // Parse the 12-hour format with AM/PM
    if (circuitData && circuitData.timezone) {
        const timeString = circuitData.timezone;
        console.log('🕒 Raw time string:', timeString);
        
        // Parse "6:10 PM" format
        const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const period = timeMatch[3].toUpperCase();
            
            // Convert to 24-hour format
            if (period === 'PM' && hours < 12) {
                hours += 12;
            } else if (period === 'AM' && hours === 12) {
                hours = 0;
            }
            
            raceDateTime.setHours(hours, minutes, 0, 0);
            console.log(`🎯 Using parsed race time: ${hours}:${minutes.toString().padStart(2, '0')} (24-hour)`);
            console.log(`🏁 Race will start at: ${raceDateTime.toLocaleString()}`);
        } else {
            // Default to 2:00 PM if time format not recognized
            raceDateTime.setHours(14, 0, 0, 0);
            console.log('⚠️ Could not parse time format, using default 14:00');
        }
    } else {
        // Default to 2:00 PM if no time specified
        raceDateTime.setHours(14, 0, 0, 0);
        console.log('⚠️ No race time found, using default 14:00');
    }

    const now = new Date();
    const timeDiff = raceDateTime - now;
    const timeSinceRaceStart = now - raceDateTime;
    const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    console.log('🏁 Race DateTime:', raceDateTime.toLocaleString());
    console.log('⏰ Current Time:', now.toLocaleString());
    console.log('⏱️ Time Until Race:', Math.floor(timeDiff / 1000 / 60) + ' minutes');
    console.log('⏰ Time Since Race Start:', Math.floor(timeSinceRaceStart / 1000 / 60) + ' minutes');

    // Auto-hide timer if race started more than 2 hours ago
    if (timeSinceRaceStart > twoHoursInMs) {
        console.log('⏰ Race finished 2+ hours ago, hiding countdown');
        return; // Don't show any countdown
    }

    if (timeDiff <= 0) {
        // Race has started or finished, but less than 2 hours ago
        const countdownHTML = `
            <div class="countdown-timer countdown-finished">
                <div class="countdown-time">LIVE</div>
                <div class="countdown-label">${nextRace.name}</div>
            </div>
        `;
        header.insertAdjacentHTML('beforeend', countdownHTML);
        return;
    }

    // Calculate ALL time components
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    // Format the countdown text
    let countdownText;
    if (days > 0) {
        countdownText = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
        countdownText = `${hours}h ${minutes}m ${seconds}s`;
    } else {
        countdownText = `${minutes}m ${seconds}s`;
    }

    const countdownHTML = `
        <div class="countdown-timer">
            <div class="countdown-time">${countdownText}</div>
            <div class="countdown-label">Until ${nextRace.name}</div>
        </div>
    `;

    header.insertAdjacentHTML('beforeend', countdownHTML);
}

// Update countdown every second
let countdownInterval;

function startCountdown() {
    updateRaceCountdown();
    countdownInterval = setInterval(updateRaceCountdown, 1000);
    
    // Set up auto-stop after 2 hours if race is live or upcoming
    const nextRace = window.raceCalendar?.nextRace;
    if (nextRace) {
        const circuitData = window.raceCalendar.circuitData ? window.raceCalendar.circuitData[nextRace.name] : null;
        let raceDateTime = new Date(nextRace.date);
        
        if (circuitData && circuitData.timezone) {
            const timeString = circuitData.timezone;
            const timeMatch = timeString.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = parseInt(timeMatch[2]);
                const period = timeMatch[3].toUpperCase();
                
                if (period === 'PM' && hours < 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;
                
                raceDateTime.setHours(hours, minutes, 0, 0);
            }
        }
        
        const now = new Date();
        const timeSinceRaceStart = now - raceDateTime;
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        
        // If race started less than 2 hours ago, set timeout to stop countdown
        if (timeSinceRaceStart > 0 && timeSinceRaceStart <= twoHoursInMs) {
            const timeUntilHide = twoHoursInMs - timeSinceRaceStart;
            console.log(`⏰ Countdown will auto-hide in ${Math.floor(timeUntilHide / 1000 / 60)} minutes`);
            setTimeout(() => {
                clearInterval(countdownInterval);
                const countdown = document.querySelector('.countdown-timer');
                if (countdown) countdown.remove();
                console.log('⏰ Countdown stopped - race finished 2 hours ago');
            }, timeUntilHide);
        }
        // If race hasn't started yet, set timeout for when it will be 2 hours after race start
        else if (timeSinceRaceStart <= 0) {
            const timeUntilRaceStart = -timeSinceRaceStart;
            const timeUntilHide = timeUntilRaceStart + twoHoursInMs;
            console.log(`⏰ Countdown will auto-hide ${Math.floor(timeUntilHide / 1000 / 60)} minutes from now`);
            setTimeout(() => {
                clearInterval(countdownInterval);
                const countdown = document.querySelector('.countdown-timer');
                if (countdown) countdown.remove();
                console.log('⏰ Countdown stopped - race finished 2 hours ago');
            }, timeUntilHide);
        }
    }
}

// Start when page loads
window.addEventListener('load', function() {
    setTimeout(startCountdown, 2000);
});

// ===== ADMIN LOGIN FUNCTIONS =====

function showAdminLogin() {
    const modal = document.getElementById('adminLoginModal');
    const input = document.getElementById('adminPasswordInput');
    const error = document.getElementById('adminLoginError');
    
    if (modal) {
        modal.classList.add('active');
        input.value = '';
        error.style.display = 'none';
        input.focus();
    }
}

function closeAdminLogin() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function handleAdminLogin() {
    const password = document.getElementById('adminPasswordInput').value;
    const error = document.getElementById('adminLoginError');
    
    // Simple password check - you can change "admin123" to whatever you want
    if (password === '5xWDC') {
        // Set admin session flag
        localStorage.setItem('efc_admin', 'true');
        // Redirect to admin page
        window.location.href = 'admin.html';
    } else {
        error.style.display = 'block';
        document.getElementById('adminPasswordInput').focus();
    }
}

// Initialize admin login functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Allow pressing Enter to submit
    const passwordInput = document.getElementById('adminPasswordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleAdminLogin();
            }
        });
    }
    
    // Close modal when clicking outside
    const loginModal = document.getElementById('adminLoginModal');
    if (loginModal) {
        loginModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAdminLogin();
            }
        });
    }
});