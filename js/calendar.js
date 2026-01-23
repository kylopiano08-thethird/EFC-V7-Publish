/**
 * Calendar Page Script - TRACK-FOCUSED VERSION
 * Makes track images the main focus with gallery functionality
 */

class TrackCalendarManager {
    constructor() {
        this.dataLoader = window.efcDataLoader || efcDataLoader;
        this.isInitialized = false;
        this.selectedTrack = null;
        this.countdownInterval = null;
        
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
            
            // Gallery modal
            trackGalleryModal: document.getElementById('track-gallery-modal'),
            modalTrackName: document.getElementById('modal-track-name'),
            galleryMainImage: document.getElementById('gallery-main-image'),
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
            // Use the data loader's existing method to get calendar data
            const calendarData = await this.dataLoader.loadCalendarData();
            
            if (!calendarData || !calendarData.races || calendarData.races.length === 0) {
                console.warn('No calendar data available, using mock data');
                this.updateWithFallbackData();
                return;
            }
            
            console.log('Calendar data loaded:', calendarData.races);
            console.log('Circuits:', calendarData.circuits);
            
            // Update all displays
            this.updateAllTrackDisplays(calendarData);
            this.setupEventListeners();
            this.startCountdownTimer(calendarData.nextRace);
            
            // Select next race by default
            if (calendarData.nextRace) {
                this.selectTrack(calendarData.nextRace, calendarData.circuits);
            } else if (calendarData.races.length > 0) {
                this.selectTrack(calendarData.races[0], calendarData.circuits);
            }
            
            this.isInitialized = true;
            console.log('Track calendar initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize track calendar:', error);
            this.updateWithFallbackData();
        }
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
        
        // Update track statistics
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
            this.elements.upcomingRaces.textContent = stats.upcoming || 0;
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
        
        console.log('Updating main track display:', { track, circuit });
        
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
        console.log('Updating track details:', { track, circuit });
        
        // Update basic info
        if (this.elements.trackRaceStatus) {
            this.elements.trackRaceStatus.textContent = track.status?.toUpperCase() || 'UPCOMING';
        }
        
        if (this.elements.trackLength) {
            this.elements.trackLength.textContent = circuit?.length || 'TBA';
        }
        
        if (this.elements.trackLaps) {
            // Laps data is already in track object from data-loader
            this.elements.trackLaps.textContent = track.laps || circuit?.laps || 'TBA';
        }
        
        if (this.elements.trackDistance) {
            this.elements.trackDistance.textContent = track.distance || 'TBA';
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
        
        console.log('Updating track grid with', races.length, 'races');
        
        const trackCards = races.map(race => {
            const circuit = circuits.find(c => c.id === race.circuitId) || {};
            const trackImageUrl = circuit?.trackLayoutImage || '';
            
            return this.createTrackCardHTML(race, circuit, trackImageUrl);
        }).join('');
        
        this.elements.trackGrid.innerHTML = trackCards;
        
        // Add click events to track cards
        this.addTrackCardEvents(races, circuits);
    }
    
    /**
     * Create HTML for a track card with laps data
     */
    createTrackCardHTML(race, circuit, trackImageUrl) {
        const statusClass = race.status || 'upcoming';
        const statusText = race.status ? race.status.toUpperCase() : 'UPCOMING';
        
        console.log('Creating card for:', race.name, 'laps:', race.laps);
        
        // Check if we have a valid image
        const hasImage = trackImageUrl && trackImageUrl.trim() !== '' && 
                        (trackImageUrl.startsWith('http://') || trackImageUrl.startsWith('https://'));
        
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
                            <span class="track-card-spec-value">${race.laps || 'TBA'}</span>
                        </div>
                        <div class="track-card-spec">
                            <span class="track-card-spec-label">Date</span>
                            <span class="track-card-spec-value">${race.date || 'TBD'}</span>
                        </div>
                        <div class="track-card-spec">
                            <span class="track-card-spec-label">Distance</span>
                            <span class="track-card-spec-value">${race.distance || 'TBA'}</span>
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
            
            // Calculate laps from race data
            if (race.laps) {
                const lapsMatch = race.laps.toString().match(/(\d+)/);
                if (lapsMatch) {
                    const laps = parseInt(lapsMatch[1]);
                    if (!isNaN(laps)) {
                        totalLaps += laps;
                    }
                }
            }
            
            // Calculate distance from race data
            if (race.distance) {
                const match = race.distance.match(/(\d+\.?\d*)/);
                if (match) {
                    const distance = parseFloat(match[1]);
                    if (!isNaN(distance)) {
                        totalDistance += distance;
                    }
                }
            }
        });
        
        console.log('Track stats calculated:', { totalLength, totalLaps, totalDistance });
        
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
                if (!calendarData) return;
                
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
                if (!calendarData) return;
                
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
        if (!calendarData) return;
        
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
        if (!nextRace) {
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = 'LOADING...';
            }
            return;
        }
        
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
        
        // Clear any existing interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        // Update immediately
        updateTimer();
        
        // Update every second
        this.countdownInterval = setInterval(updateTimer, 1000);
    }
    
    /**
     * Start countdown timer
     */
    startCountdownTimer(nextRace) {
        if (nextRace) {
            this.updateHeaderCountdown(nextRace);
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
                    distance: "150.942 km",
                    rawDate: "2024-03-30"
                },
                {
                    round: "Round 2",
                    name: "Australia Grand Prix",
                    date: "April 13, 2024",
                    circuit: "Albert Park",
                    location: "Melbourne, Australia",
                    status: "upcoming",
                    circuitId: "CIRC2",
                    laps: "58",
                    distance: "307.574 km",
                    rawDate: "2024-04-13"
                },
                {
                    round: "Round 3",
                    name: "Japan Grand Prix",
                    date: "April 27, 2024",
                    circuit: "Suzuka Circuit",
                    location: "Suzuka, Japan",
                    status: "upcoming",
                    circuitId: "CIRC3",
                    laps: "53",
                    distance: "307.573 km",
                    rawDate: "2024-04-27"
                }
            ],
            circuits: [
                {
                    id: "CIRC1",
                    raceName: "Germany Grand Prix",
                    circuitName: "Hockenheimring",
                    location: "Hockenheim, Germany",
                    length: "4.574 km",
                    laps: "33",
                    record: "1:13.780",
                    description: "A challenging mix of high-speed straights and technical stadium complex.",
                    trackLayoutImage: ""
                },
                {
                    id: "CIRC2",
                    raceName: "Australia Grand Prix",
                    circuitName: "Albert Park",
                    location: "Melbourne, Australia",
                    length: "5.303 km",
                    laps: "58",
                    record: "1:20.260",
                    description: "A street circuit set around Albert Park Lake featuring fast flowing corners.",
                    trackLayoutImage: ""
                },
                {
                    id: "CIRC3",
                    raceName: "Japan Grand Prix",
                    circuitName: "Suzuka Circuit",
                    location: "Suzuka, Japan",
                    length: "5.807 km",
                    laps: "53",
                    record: "1:27.064",
                    description: "A challenging figure-eight circuit known for its unique crossover section.",
                    trackLayoutImage: ""
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
                upcoming: 3,
                total: 3,
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
        trackCalendarManager.dataLoader.dataCache.calendarData = null;
        trackCalendarManager.isInitialized = false;
        trackCalendarManager.selectedTrack = null;
        if (trackCalendarManager.countdownInterval) {
            clearInterval(trackCalendarManager.countdownInterval);
            trackCalendarManager.countdownInterval = null;
        }
        trackCalendarManager.initialize();
    });
    document.body.appendChild(refreshBtn);
});