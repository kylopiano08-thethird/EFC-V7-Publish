
/**
 * Calendar Page Script - TRACK-FOCUSED VERSION
 * Makes track images the main focus with gallery functionality
 */

class TrackCalendarManager {
    constructor() {
        this.dataLoader = efcDataLoader;
        this.isInitialized = false;
        this.selectedTrack = null;
        this.countdownInterval = null;
        
        // Store laps data from RaceCalendar row 5
        this.raceLapsData = {};
        
        // DOM Elements
        this.elements = {
            // Header countdown
            timerDisplay: document.getElementById('timer-display'),
            
            // Main track display
            mainTrackImage: document.getElementById('main-track-image'),
            mainTrackName: document.getElementById('main-track-name'),
            mainTrackLocation: document.getElementById('main-track-location'),
            
            // Track details
            trackRaceStatus: document.getElementById('track-race-status'),
            trackLength: document.getElementById('track-length'),
            trackLaps: document.getElementById('track-laps'),
            trackDistance: document.getElementById('track-distance'),
            trackRecord: document.getElementById('track-record'),
            trackDate: document.getElementById('track-date'),
            trackStatus: document.getElementById('track-status'),
            trackDescription: document.getElementById('track-description'),
            
            // Season progress
            racesCompleted: document.getElementById('races-completed'),
            upcomingRaces: document.getElementById('upcoming-races'),
            totalRaces: document.getElementById('total-races'),
            seasonProgressCircle: document.getElementById('season-progress-circle'),
            seasonProgressPercent: document.getElementById('season-progress-percent'),
            
            // Quick calendar
            quickCalendarList: document.getElementById('quick-calendar-list'),
            
            // Full calendar
            trackGrid: document.getElementById('track-grid'),
            
            // Track stats
            totalTrackLength: document.getElementById('total-track-length'),
            totalLaps: document.getElementById('total-laps'),
            totalDistance: document.getElementById('total-distance'),
            avgTrackLength: document.getElementById('avg-track-length'),
            
            // Gallery modal
            trackGalleryModal: document.getElementById('track-gallery-modal'),
            modalTrackName: document.getElementById('modal-track-name'),
            galleryMainImage: document.getElementById('gallery-main-image'),
            galleryThumbnails: document.getElementById('gallery-thumbnails'),
            modalClose: document.getElementById('modal-close'),
            
            // Buttons and controls
            zoomTrackBtn: document.getElementById('zoom-track-btn'),
            downloadTrackBtn: document.getElementById('download-track-btn')
        };
    }
    
    /**
     * Initialize the track-focused calendar
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Initializing track-focused calendar...');
        
        try {
            await this.dataLoader.loadCalendarData();
            const calendarData = this.dataLoader.getCalendarData();
            
            if (calendarData && calendarData.races && calendarData.races.length > 0) {
                // Load laps data from RaceCalendar row 5
                await this.loadRaceLapsData();
                this.updateAllTrackDisplays(calendarData);
                this.setupEventListeners();
                this.startCountdownTimer();
                
                // Select next race by default
                const nextRace = calendarData.races.find(race => race.status === 'next') || 
                                calendarData.races.find(race => race.status === 'upcoming') ||
                                calendarData.races[0];
                
                if (nextRace) {
                    this.selectTrack(nextRace, calendarData.circuits);
                }
                
                this.isInitialized = true;
                console.log('Track calendar initialized successfully');
            } else {
                this.updateWithFallbackData();
            }
            
        } catch (error) {
            console.error('Failed to initialize track calendar:', error);
            this.updateWithFallbackData();
        }
    }
    
    /**
     * Load laps data from RaceCalendar row 5
     */
    async loadRaceLapsData() {
        try {
            const sheetId = '1q5C96pUBR5SUsW3lTyF8LFbzkSlPYVa8w-hrW564Rxo';
            const sheetName = 'RaceCalendar';
            const apiKey = this.dataLoader.API_KEY;
            
            // Fetch RaceCalendar sheet data
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.values && data.values.length >= 5) {
                // Row 5 contains laps data (0-based index, so row 5 is index 4)
                const lapsRow = data.values[4];
                
                // Row structure: 
                // Column A: "Laps" header
                // Columns B-L: Laps for each race (Round 1-11)
                
                if (lapsRow && lapsRow.length >= 2) {
                    // Skip column A (header) and get laps for each race
                    for (let i = 1; i < lapsRow.length; i++) {
                        const roundNumber = i; // i=1 = Round 1, i=2 = Round 2, etc.
                        const lapsValue = lapsRow[i];
                        
                        // Store laps data by round number
                        this.raceLapsData[`Round ${roundNumber}`] = lapsValue;
                        
                        console.log(`Round ${roundNumber}: ${lapsValue} laps`);
                    }
                }
            }
        } catch (error) {
            console.warn('Could not load laps data from RaceCalendar:', error);
        }
    }
    
    /**
     * Get laps for a specific round
     */
    getLapsForRound(roundName) {
        if (this.raceLapsData[roundName]) {
            return this.raceLapsData[roundName];
        }
        
        // Try to extract round number from different formats
        const roundMatch = roundName?.match(/Round\s*(\d+)/i);
        if (roundMatch) {
            const roundNum = parseInt(roundMatch[1]);
            return this.raceLapsData[`Round ${roundNum}`];
        }
        
        return null;
    }
    
    /**
     * Update all track displays
     */
    updateAllTrackDisplays(calendarData) {
        const { races, circuits, nextRace, stats } = calendarData;
        
        // Update season progress
        this.updateSeasonProgress(stats);
        
        // Update quick calendar
        this.updateQuickCalendar(races);
        
        // Update track grid with laps data
        this.updateTrackGrid(races, circuits);
        
        // Update track statistics with laps data
        this.updateTrackStatistics(races, circuits);
        
        // Update header countdown
        this.updateHeaderCountdown(nextRace);
    }
    
    /**
     * Update season progress
     */
    updateSeasonProgress(stats) {
        if (!stats) return;
        
        if (this.elements.racesCompleted) {
            this.elements.racesCompleted.textContent = stats.completed || 0;
        }
        
        if (this.elements.upcomingRaces) {
            // Calculate upcoming races: total - completed
            const upcoming = stats.total - stats.completed;
            this.elements.upcomingRaces.textContent = Math.max(0, upcoming) || 0;
        }
        
        if (this.elements.totalRaces) {
            this.elements.totalRaces.textContent = stats.total || 0;
        }
        
        if (this.elements.seasonProgressCircle) {
            const progress = stats.progress || 0;
            const rotation = (progress / 100) * 360;
            this.elements.seasonProgressCircle.style.transform = `rotate(${rotation}deg)`;
        }
        
        if (this.elements.seasonProgressPercent) {
            const progress = stats.progress || 0;
            this.elements.seasonProgressPercent.textContent = `${progress}%`;
        }
    }
    
    /**
     * Update quick calendar list
     */
    updateQuickCalendar(races) {
        if (!this.elements.quickCalendarList) return;
        
        if (!races || races.length === 0) {
            this.elements.quickCalendarList.innerHTML = `
                <div class="quick-calendar-loading">
                    <i class="fas fa-calendar-times"></i>
                    <span>No races scheduled</span>
                </div>
            `;
            return;
        }
        
        // Show only upcoming races (max 5)
        const upcomingRaces = races.filter(race => 
            race.status === 'upcoming' || race.status === 'next'
        ).slice(0, 5);
        
        if (upcomingRaces.length === 0) {
            // Show completed races if no upcoming
            const recentRaces = races.slice(-5).reverse();
            const quickCalendarHTML = recentRaces.map(race => `
                <div class="quick-calendar-item" data-track-id="${race.circuitId || ''}">
                    <div class="quick-calendar-round">${race.round?.replace('Round ', 'R') || 'R-'}</div>
                    <div class="quick-calendar-content">
                        <div class="quick-calendar-name">${race.name}</div>
                        <div class="quick-calendar-date">${race.date}</div>
                    </div>
                </div>
            `).join('');
            
            this.elements.quickCalendarList.innerHTML = quickCalendarHTML;
        } else {
            const quickCalendarHTML = upcomingRaces.map(race => `
                <div class="quick-calendar-item" data-track-id="${race.circuitId || ''}">
                    <div class="quick-calendar-round">${race.round?.replace('Round ', 'R') || 'R-'}</div>
                    <div class="quick-calendar-content">
                        <div class="quick-calendar-name">${race.name}</div>
                        <div class="quick-calendar-date">${race.date}</div>
                    </div>
                </div>
            `).join('');
            
            this.elements.quickCalendarList.innerHTML = quickCalendarHTML;
        }
        
        // Add click events
        this.addQuickCalendarEvents();
    }
    
    /**
     * Update main track display with large image
     */
    updateMainTrackDisplay(track, circuit) {
        if (!track) return;
        
        // Get track image from CircuitMaster column H
        const trackImageUrl = circuit?.trackLayoutImage || '';
        
        // Update main track image
        if (this.elements.mainTrackImage) {
            if (trackImageUrl && trackImageUrl.trim() !== '' && 
                (trackImageUrl.startsWith('http://') || trackImageUrl.startsWith('https://'))) {
                this.elements.mainTrackImage.innerHTML = `
                    <img src="${trackImageUrl}" 
                         alt="${circuit?.circuitName || track.circuit}" 
                         class="track-main-image"
                         onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'track-image-placeholder\\'><i class=\\'fas fa-flag-checkered\\'></i><span>NO PICTURE AVAILABLE</span></div>';">
                `;
            } else {
                this.elements.mainTrackImage.innerHTML = `
                    <div class="track-image-placeholder">
                        <i class="fas fa-flag-checkered"></i>
                        <span>NO PICTURE AVAILABLE</span>
                    </div>
                `;
            }
        }
        
        // Update track name and location
        if (this.elements.mainTrackName) {
            this.elements.mainTrackName.textContent = circuit?.circuitName || track.circuit || 'Select a Track';
        }
        
        if (this.elements.mainTrackLocation) {
            this.elements.mainTrackLocation.innerHTML = `
                <i class="fas fa-map-marker-alt"></i>
                ${circuit?.location || track.location || 'Location information'}
            `;
        }
        
        // Update all track details
        this.updateTrackDetails(track, circuit);
    }
    
    /**
     * Update track details panel
     */
    updateTrackDetails(track, circuit) {
        // Get laps from RaceCalendar row 5
        const lapsFromCalendar = this.getLapsForRound(track.round);
        
        // Update basic info
        if (this.elements.trackRaceStatus) {
            this.elements.trackRaceStatus.textContent = track.status?.toUpperCase() || 'UPCOMING';
        }
        
        if (this.elements.trackLength) {
            this.elements.trackLength.textContent = circuit?.length || 'TBA';
        }
        
        if (this.elements.trackLaps) {
            // Priority: 1. RaceCalendar row 5, 2. CircuitMaster, 3. Race data
            this.elements.trackLaps.textContent = lapsFromCalendar || circuit?.laps || track.laps || 'TBA';
        }
        
        if (this.elements.trackDistance) {
            this.elements.trackDistance.textContent = 
                track.distance || 
                this.calculateRaceDistance(circuit, track, lapsFromCalendar) || 
                'TBA';
        }
        
        if (this.elements.trackRecord) {
            this.elements.trackRecord.textContent = circuit?.record || 'TBA';
        }
        
        if (this.elements.trackDate) {
            this.elements.trackDate.textContent = track.date || 'TBD';
        }
        
        if (this.elements.trackStatus) {
            this.elements.trackStatus.textContent = track.status?.toUpperCase() || 'UPCOMING';
        }
        
        // Update description from CircuitMaster column F
        if (this.elements.trackDescription) {
            this.elements.trackDescription.textContent = 
                circuit?.description || 
                `The ${circuit?.circuitName || track.circuit} is one of the circuits on the EFC Season 2 calendar.`;
        }
    }
    
    /**
     * Update track grid with images and laps data
     */
    updateTrackGrid(races, circuits) {
        if (!this.elements.trackGrid) return;
        
        if (!races || races.length === 0) {
            this.elements.trackGrid.innerHTML = `
                <div class="track-grid-loading">
                    <i class="fas fa-search"></i>
                    <p>No tracks available</p>
                </div>
            `;
            return;
        }
        
        const trackCards = races.map(race => {
            const circuit = circuits.find(c => c.id === race.circuitId) || {};
            const trackImageUrl = circuit?.trackLayoutImage || '';
            
            // Get laps for this race from RaceCalendar row 5
            const lapsFromCalendar = this.getLapsForRound(race.round);
            
            return this.createTrackCardHTML(race, circuit, trackImageUrl, lapsFromCalendar);
        }).join('');
        
        this.elements.trackGrid.innerHTML = trackCards;
        
        // Add click events to track cards
        this.addTrackCardEvents(races, circuits);
    }
    
    /**
     * Create HTML for a track card with laps data
     */
    createTrackCardHTML(race, circuit, trackImageUrl, lapsFromCalendar) {
        const statusClass = race.status || 'upcoming';
        const statusText = race.status ? race.status.toUpperCase() : 'UPCOMING';
        
        // Check if we have a valid image
        const hasImage = trackImageUrl && trackImageUrl.trim() !== '' && 
                        (trackImageUrl.startsWith('http://') || trackImageUrl.startsWith('https://'));
        
        // Determine which laps value to use
        const lapsValue = lapsFromCalendar || race.laps || circuit?.laps || 'TBA';
        
        return `
            <div class="track-card ${statusClass}" data-track-id="${race.circuitId || ''}">
                <div class="track-image-card">
                    ${hasImage ? `
                        <img src="${trackImageUrl}" 
                             alt="${circuit?.circuitName || race.circuit}" 
                             class="track-card-image"
                             onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,247,255,0.1);\\'><span style=\\'color:rgba(0,247,255,0.5);font-weight:bold;\\'>NO PICTURE</span></div>';">
                    ` : `
                        <div class="track-card-image" style="display: flex; align-items: center; justify-content: center; background: rgba(0, 247, 255, 0.1);">
                            <span style="color: rgba(0, 247, 255, 0.5); font-weight: bold; font-size: 0.9rem;">NO PICTURE</span>
                        </div>
                    `}
                    <div class="track-image-overlay-card">
                        <div class="track-round-badge">${race.round}</div>
                        <div class="track-status-badge ${statusClass}">${statusText}</div>
                        <div class="track-name-overlay">${circuit?.circuitName || race.circuit}</div>
                    </div>
                </div>
                <div class="track-card-content">
                    <h4 class="track-card-name">${race.name}</h4>
                    <div class="track-card-location">
                        <i class="fas fa-map-marker-alt"></i>
                        ${circuit?.location || race.location || 'TBA'}
                    </div>
                    <div class="track-card-specs">
                        <div class="track-card-spec">
                            <span class="track-card-spec-label">Length</span>
                            <span class="track-card-spec-value">${circuit?.length || 'TBA'}</span>
                        </div>
                        <div class="track-card-spec">
                            <span class="track-card-spec-label">Laps</span>
                            <span class="track-card-spec-value">${lapsValue}</span>
                        </div>
                        <div class="track-card-spec">
                            <span class="track-card-spec-label">Date</span>
                            <span class="track-card-spec-value">${race.date || 'TBD'}</span>
                        </div>
                        <div class="track-card-spec">
                            <span class="track-card-spec-label">Distance</span>
                            <span class="track-card-spec-value">${this.calculateRaceDistance(circuit, race, lapsFromCalendar) || 'TBA'}</span>
                        </div>
                    </div>
                    <div class="track-card-actions">
                        <button class="track-card-btn primary" data-action="view">
                            <i class="fas fa-eye"></i> VIEW
                        </button>
                        <button class="track-card-btn" data-action="gallery">
                            <i class="fas fa-images"></i> GALLERY
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Update track statistics with laps data
     */
    updateTrackStatistics(races, circuits) {
        if (!races || races.length === 0) return;
        
        let totalLength = 0;
        let totalLaps = 0;
        let totalDistance = 0;
        let circuitsWithLength = 0;
        
        races.forEach(race => {
            const circuit = circuits.find(c => c.id === race.circuitId);
            
            // Calculate track length
            const lengthStr = circuit?.length;
            if (lengthStr) {
                const match = lengthStr.match(/(\d+\.?\d*)/);
                if (match) {
                    totalLength += parseFloat(match[1]);
                    circuitsWithLength++;
                }
            }
            
            // Calculate total laps using RaceCalendar row 5 data
            const lapsFromCalendar = this.getLapsForRound(race.round);
            let lapsValue;
            
            if (lapsFromCalendar) {
                // Parse laps from RaceCalendar
                const lapsMatch = lapsFromCalendar.match(/(\d+)/);
                lapsValue = lapsMatch ? parseInt(lapsMatch[1]) : 0;
            } else if (race.laps) {
                // Fallback to race data
                const lapsMatch = race.laps.toString().match(/(\d+)/);
                lapsValue = lapsMatch ? parseInt(lapsMatch[1]) : 0;
            } else if (circuit?.laps) {
                // Fallback to circuit data
                const lapsMatch = circuit.laps.toString().match(/(\d+)/);
                lapsValue = lapsMatch ? parseInt(lapsMatch[1]) : 0;
            } else {
                lapsValue = 0;
            }
            
            if (!isNaN(lapsValue) && lapsValue > 0) {
                totalLaps += lapsValue;
            }
            
            // Calculate distance
            const distanceStr = race.distance;
            if (distanceStr) {
                const match = distanceStr.match(/(\d+\.?\d*)/);
                if (match) {
                    totalDistance += parseFloat(match[1]);
                }
            } else if (circuit?.length && lapsValue > 0) {
                // Calculate distance from circuit length and laps
                const lengthMatch = circuit.length.match(/(\d+\.?\d*)/);
                if (lengthMatch) {
                    const lengthKm = parseFloat(lengthMatch[1]);
                    const distance = lengthKm * lapsValue;
                    totalDistance += distance;
                }
            }
        });
        
        // Update UI
        if (this.elements.totalTrackLength) {
            this.elements.totalTrackLength.textContent = `${totalLength.toFixed(2)} km`;
        }
        
        if (this.elements.totalLaps) {
            this.elements.totalLaps.textContent = totalLaps;
        }
        
        if (this.elements.totalDistance) {
            this.elements.totalDistance.textContent = `${totalDistance.toFixed(2)} km`;
        }
        
        if (this.elements.avgTrackLength && circuitsWithLength > 0) {
            const avgLength = totalLength / circuitsWithLength;
            this.elements.avgTrackLength.textContent = `${avgLength.toFixed(2)} km`;
        }
    }
    
    /**
     * Calculate race distance with laps data
     */
    calculateRaceDistance(circuit, track, lapsFromCalendar = null) {
        // Try track data first
        if (track.distance && track.distance.trim() !== '') {
            return track.distance;
        }
        
        // Try circuit data with laps
        if (!circuit?.length) return null;
        
        try {
            const lengthMatch = circuit.length.match(/(\d+\.?\d*)/);
            if (!lengthMatch) return null;
            
            const lengthKm = parseFloat(lengthMatch[1]);
            let lapsValue;
            
            // Determine laps value (priority: RaceCalendar > track data > circuit data)
            if (lapsFromCalendar) {
                const lapsMatch = lapsFromCalendar.match(/(\d+)/);
                lapsValue = lapsMatch ? parseInt(lapsMatch[1]) : 0;
            } else if (track.laps) {
                const lapsMatch = track.laps.toString().match(/(\d+)/);
                lapsValue = lapsMatch ? parseInt(lapsMatch[1]) : 0;
            } else if (circuit?.laps) {
                const lapsMatch = circuit.laps.toString().match(/(\d+)/);
                lapsValue = lapsMatch ? parseInt(lapsMatch[1]) : 0;
            } else {
                return null;
            }
            
            if (isNaN(lengthKm) || isNaN(lapsValue) || lapsValue <= 0) return null;
            
            const distance = lengthKm * lapsValue;
            return `${distance.toFixed(2)} km`;
        } catch (error) {
            console.error('Error calculating race distance:', error);
            return null;
        }
    }
    
    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Track card clicks
        document.addEventListener('click', (e) => {
            const trackCard = e.target.closest('.track-card');
            if (trackCard) {
                const trackId = trackCard.dataset.trackId;
                const calendarData = this.dataLoader.getCalendarData();
                const race = calendarData.races.find(r => r.circuitId === trackId);
                const circuit = calendarData.circuits.find(c => c.id === trackId);
                
                if (race) {
                    this.selectTrack(race, calendarData.circuits);
                    this.scrollToTop();
                }
            }
            
            // Track card button clicks
            const trackCardBtn = e.target.closest('.track-card-btn');
            if (trackCardBtn) {
                const action = trackCardBtn.dataset.action;
                const trackCard = trackCardBtn.closest('.track-card');
                const trackId = trackCard.dataset.trackId;
                
                if (action === 'view') {
                    // Already handled by card click
                } else if (action === 'gallery') {
                    this.openTrackGallery(trackId);
                }
            }
            
            // Quick calendar item clicks
            const quickItem = e.target.closest('.quick-calendar-item');
            if (quickItem) {
                const trackId = quickItem.dataset.trackId;
                const calendarData = this.dataLoader.getCalendarData();
                const race = calendarData.races.find(r => r.circuitId === trackId);
                const circuit = calendarData.circuits.find(c => c.id === trackId);
                
                if (race) {
                    this.selectTrack(race, calendarData.circuits);
                    this.scrollToTop();
                }
            }
        });
        
        // Zoom track button
        if (this.elements.zoomTrackBtn) {
            this.elements.zoomTrackBtn.addEventListener('click', () => {
                if (this.selectedTrack) {
                    this.openTrackGallery(this.selectedTrack.circuitId);
                }
            });
        }
        
        // Download track button (mock functionality)
        if (this.elements.downloadTrackBtn) {
            this.elements.downloadTrackBtn.addEventListener('click', () => {
                if (this.selectedTrack) {
                    alert('Download functionality would save the track image.\nIn a real implementation, this would trigger a download.');
                }
            });
        }
        
        // Modal close
        if (this.elements.modalClose) {
            this.elements.modalClose.addEventListener('click', () => {
                this.closeTrackGallery();
            });
        }
        
        // Close modal on overlay click
        if (this.elements.trackGalleryModal) {
            this.elements.trackGalleryModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    this.closeTrackGallery();
                }
            });
        }
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.trackGalleryModal.classList.contains('active')) {
                this.closeTrackGallery();
            }
        });
    }
    
    /**
     * Add click events to quick calendar items
     */
    addQuickCalendarEvents() {
        const quickItems = document.querySelectorAll('.quick-calendar-item');
        quickItems.forEach(item => {
            item.addEventListener('click', () => {
                quickItems.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
    }
    
    /**
     * Add click events to track cards
     */
    addTrackCardEvents(races, circuits) {
        const trackCards = document.querySelectorAll('.track-card');
        trackCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on a button
                if (!e.target.closest('.track-card-btn')) {
                    const trackId = card.dataset.trackId;
                    const race = races.find(r => r.circuitId === trackId);
                    const circuit = circuits.find(c => c.id === trackId);
                    
                    if (race) {
                        this.selectTrack(race, circuits);
                        
                        // Scroll to top on mobile
                        if (window.innerWidth < 768) {
                            document.querySelector('.track-spotlight').scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                        }
                    }
                }
            });
        });
    }
    
    /**
     * Open track gallery modal
     */
    openTrackGallery(trackId) {
        const calendarData = this.dataLoader.getCalendarData();
        const race = calendarData.races.find(r => r.circuitId === trackId);
        const circuit = calendarData.circuits.find(c => c.id === trackId);
        
        if (!race || !circuit) return;
        
        const trackImageUrl = circuit.trackLayoutImage || '';
        
        if (!trackImageUrl || trackImageUrl.trim() === '') {
            alert('No track image available for this circuit.');
            return;
        }
        
        // Update modal content
        if (this.elements.modalTrackName) {
            this.elements.modalTrackName.textContent = circuit.circuitName || race.circuit;
        }
        
        if (this.elements.galleryMainImage) {
            this.elements.galleryMainImage.innerHTML = `
                <img src="${trackImageUrl}" 
                     alt="${circuit.circuitName || race.circuit}"
                     class="gallery-main-img"
                     onerror="alert('Failed to load track image.'); this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--gray);\\'><i class=\\"fas fa-exclamation-triangle\\"></i> Image failed to load</div>';">
            `;
        }
        
        // Show modal
        this.elements.trackGalleryModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    /**
     * Close track gallery modal
     */
    closeTrackGallery() {
        this.elements.trackGalleryModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    /**
     * Select a track to display
     */
    selectTrack(race, circuits) {
        this.selectedTrack = race;
        const circuit = circuits.find(c => c.id === race.circuitId) || {};
        this.updateMainTrackDisplay(race, circuit);
    }
    
    /**
     * Scroll to top of page
     */
    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
    
    /**
     * Update header countdown
     */
    updateHeaderCountdown(nextRace) {
        if (!nextRace) return;
        
        if (nextRace.status === 'upcoming' || nextRace.status === 'next') {
            this.updateHeaderTimer(nextRace.rawDate || nextRace.date);
        } else if (nextRace.status === 'completed') {
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = 'SEASON COMPLETED';
            }
        } else {
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = 'SEASON IN PROGRESS';
            }
        }
    }
    
    /**
     * Update header timer
     */
    updateHeaderTimer(dateStr) {
        let targetDate;
        
        try {
            if (dateStr.includes(',')) {
                targetDate = new Date(dateStr);
            } else if (dateStr.includes('/')) {
                const [month, day, year] = dateStr.split('/').map(Number);
                targetDate = new Date(year, month - 1, day);
            } else {
                targetDate = new Date(dateStr);
            }
            
            if (isNaN(targetDate.getTime())) {
                throw new Error('Invalid date');
            }
            
        } catch (error) {
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 7);
        }
        
        const updateTimer = () => {
            const now = new Date();
            const diff = targetDate - now;
            
            if (diff <= 0) {
                if (this.elements.timerDisplay) {
                    this.elements.timerDisplay.textContent = 'RACE DAY!';
                }
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const timerString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
            
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = timerString;
            }
        };
        
        // Update immediately
        updateTimer();
    }
    
    /**
     * Start countdown timer
     */
    startCountdownTimer() {
        const calendarData = this.dataLoader.getCalendarData();
        if (calendarData && calendarData.nextRace) {
            this.updateHeaderCountdown(calendarData.nextRace);
        }
    }
    
    /**
     * Update with fallback data
     */
    updateWithFallbackData() {
        console.log('Using fallback data for track calendar');
        
        // Create mock data with some laps
        const mockData = {
            races: [
                {
                    round: "Round 1",
                    name: "Germany Grand Prix",
                    date: "March 30, 2024",
                    circuit: "Hockenheimring",
                    location: "Hockenheim, Germany",
                    status: "upcoming",
                    circuitId: "CIRC1",
                    laps: "33",
                    distance: "150.942 km"
                }
            ],
            circuits: [
                {
                    id: "CIRC1",
                    circuitName: "Hockenheimring",
                    location: "Hockenheim, Germany",
                    length: "4.574 km",
                    description: "A challenging mix of high-speed straights and technical stadium complex."
                }
            ],
            nextRace: {
                round: "Round 1",
                name: "Germany Grand Prix",
                date: "March 30, 2024",
                circuit: "Hockenheimring",
                location: "Hockenheim, Germany",
                status: "upcoming",
                rawDate: "2024-03-30"
            },
            stats: {
                completed: 0,
                upcoming: 1,
                total: 1,
                progress: 0
            }
        };
        
        this.updateAllTrackDisplays(mockData);
        
        // Select first track (which is the next race in mock data)
        this.selectTrack(mockData.races[0], mockData.circuits);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const trackCalendarManager = new TrackCalendarManager();
    trackCalendarManager.initialize();
    
    // Add refresh button for debugging
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '🔄';
    refreshBtn.className = 'refresh-btn';
    refreshBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:1000;background:var(--primary);color:white;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;';
    refreshBtn.addEventListener('click', () => {
        trackCalendarManager.dataLoader.dataCache = {};
        trackCalendarManager.isInitialized = false;
        trackCalendarManager.raceLapsData = {};
        trackCalendarManager.initialize();
    });
    document.body.appendChild(refreshBtn);
});
