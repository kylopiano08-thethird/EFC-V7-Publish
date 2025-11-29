// scripts/circuit-maps.js
class CircuitMaps {
    constructor() {
        this.circuits = {};
        this.init();
    }

    async init() {
        await this.loadCircuitData();
    }

    async loadCircuitData() {
        this.circuits = {
            'monaco': {
                name: 'Circuit de Monaco',
                country: 'Monaco',
                length: '3.337 km',
                laps: 78,
                distance: '260.52 km',
                lapRecord: '1:10.166 (Lewis Hamilton, 2019)',
                corners: 19,
                image: 'https://via.placeholder.com/400x200/024cad/ffffff?text=Monaco+Circuit',
                description: 'The most glamorous and historic circuit on the calendar, known for its tight streets and unforgiving barriers.',
                hotspots: [
                    { corner: 'Turn 1 (Sainte Devote)', description: 'Heavy braking zone, common overtaking spot' },
                    { corner: 'Turn 6 (Grand Hotel Hairpin)', description: 'Slowest corner in F1, crucial for exit speed' },
                    { corner: 'Turn 10 (Tunnel)', description: 'High-speed section leading to chicane' },
                    { corner: 'Turn 12 (Chicane)', description: 'Braking while exiting tunnel, very challenging' }
                ]
            },
            'silverstone': {
                name: 'Silverstone Circuit',
                country: 'United Kingdom',
                length: '5.891 km',
                laps: 52,
                distance: '306.198 km',
                lapRecord: '1:27.097 (Max Verstappen, 2020)',
                corners: 18,
                image: 'https://via.placeholder.com/400x200/dc0000/ffffff?text=Silverstone+Circuit',
                description: 'A high-speed circuit known for its sweeping corners and challenging high-speed complexes.',
                hotspots: [
                    { corner: 'Copse (Turn 9)', description: 'High-speed corner taken at over 290 km/h' },
                    { corner: 'Maggotts/Becketts', description: 'Technical high-speed sequence' },
                    { corner: 'Stowe (Turn 15)', description: 'Heavy braking zone after long straight' }
                ]
            },
            'spa': {
                name: 'Circuit de Spa-Francorchamps',
                country: 'Belgium',
                length: '7.004 km',
                laps: 44,
                distance: '308.052 km',
                lapRecord: '1:46.286 (Valtteri Bottas, 2018)',
                corners: 19,
                image: 'https://via.placeholder.com/400x200/ff8700/ffffff?text=Spa+Circuit',
                description: 'The longest circuit on the calendar, famous for its elevation changes and Eau Rouge/Raidillon complex.',
                hotspots: [
                    { corner: 'Eau Rouge/Raidillon', description: 'Legendary high-speed compression corner' },
                    { corner: 'Les Combes', description: 'Heavy braking after long straight' },
                    { corner: 'Pouhon', description: 'High-speed double left-hander' }
                ]
            }
        };
    }

    displayCircuitMap(circuitId) {
        const circuit = this.circuits[circuitId];
        if (!circuit) return;

        const container = document.getElementById('standings-container');
        container.innerHTML = this.generateCircuitHTML(circuit, circuitId);
    }

    generateCircuitHTML(circuit, circuitId) {
        return `
            <div class="circuit-detail">
                <div class="circuit-header">
                    <h2>${circuit.name}</h2>
                    <div class="circuit-location">${circuit.country}</div>
                </div>
                
                <div class="circuit-layout">
                    <div class="circuit-image">
                        <img src="${circuit.image}" alt="${circuit.name}" 
                             onerror="this.src='https://via.placeholder.com/600x300/333333/ffffff?text=Circuit+Map'">
                        <div class="circuit-overlay" id="circuit-overlay">
                            <!-- Interactive hotspots would go here -->
                        </div>
                    </div>
                    
                    <div class="circuit-info-panel">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Circuit Length</label>
                                <value>${circuit.length}</value>
                            </div>
                            <div class="info-item">
                                <label>Race Laps</label>
                                <value>${circuit.laps}</value>
                            </div>
                            <div class="info-item">
                                <label>Race Distance</label>
                                <value>${circuit.distance}</value>
                            </div>
                            <div class="info-item">
                                <label>Lap Record</label>
                                <value>${circuit.lapRecord}</value>
                            </div>
                            <div class="info-item">
                                <label>Number of Corners</label>
                                <value>${circuit.corners}</value>
                            </div>
                        </div>
                        
                        <div class="circuit-description">
                            <h4>Circuit Overview</h4>
                            <p>${circuit.description}</p>
                        </div>
                    </div>
                </div>
                
                <div class="circuit-hotspots">
                    <h3>Key Sections & Overtaking Opportunities</h3>
                    <div class="hotspots-list">
                        ${circuit.hotspots.map(hotspot => `
                            <div class="hotspot-item">
                                <div class="hotspot-corner">${hotspot.corner}</div>
                                <div class="hotspot-description">${hotspot.description}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="circuit-strategy">
                    <h3>Race Strategy</h3>
                    <div class="strategy-tips">
                        <div class="strategy-tip">
                            <strong>Tire Wear:</strong> ${this.getTireWearTip(circuitId)}
                        </div>
                        <div class="strategy-tip">
                            <strong>Pit Strategy:</strong> ${this.getPitStrategyTip(circuitId)}
                        </div>
                        <div class="strategy-tip">
                            <strong>Overtaking:</strong> ${this.getOvertakingTip(circuitId)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getTireWearTip(circuitId) {
        const tips = {
            'monaco': 'High rear tire wear due to acceleration out of slow corners',
            'silverstone': 'High-speed corners cause significant tire degradation',
            'spa': 'Mixed wear pattern due to variety of corner types'
        };
        return tips[circuitId] || 'Moderate tire wear expected';
    }

    getPitStrategyTip(circuitId) {
        const tips = {
            'monaco': 'One-stop strategy preferred, track position is crucial',
            'silverstone': 'Two-stop strategy common due to high tire wear',
            'spa': 'Flexible strategies possible, watch for safety cars'
        };
        return tips[circuitId] || 'Standard one-stop strategy expected';
    }

    getOvertakingTip(circuitId) {
        const tips = {
            'monaco': 'Very difficult to overtake, qualifying is critical',
            'silverstone': 'Good overtaking opportunities into Stowe and Vale',
            'spa': 'Multiple overtaking spots, especially into Les Combes'
        };
        return tips[circuitId] || 'Moderate overtaking opportunities available';
    }

    // Method to display circuit selector
    displayCircuitSelector() {
        const container = document.getElementById('standings-container');
        container.innerHTML = this.generateCircuitSelectorHTML();
    }

    generateCircuitSelectorHTML() {
        return `
            <div class="circuits-overview">
                <h2>EFC Championship Circuits</h2>
                <div class="circuits-grid">
                    ${Object.entries(this.circuits).map(([id, circuit]) => `
                        <div class="circuit-card" onclick="circuitMaps.displayCircuitMap('${id}')">
                            <div class="circuit-card-image">
                                <img src="${circuit.image}" alt="${circuit.name}">
                            </div>
                            <div class="circuit-card-content">
                                <h3>${circuit.name}</h3>
                                <div class="circuit-card-location">${circuit.country}</div>
                                <div class="circuit-card-specs">
                                    <span>${circuit.length}</span>
                                    <span>${circuit.corners} Corners</span>
                                </div>
                                <button class="view-circuit-btn">View Circuit Details</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

// Initialize when loaded
window.CircuitMaps = CircuitMaps;
window.circuitMaps = new CircuitMaps();