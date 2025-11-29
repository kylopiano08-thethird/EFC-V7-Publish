// scripts/data-manager.js
class DataManager {
    constructor() {
        this.localData = {
            circuits: {},
            races: [],
            news: [],
            customData: {}
        };
        this.init();
    }

    init() {
        this.loadLocalData();
    }

    loadLocalData() {
        const saved = localStorage.getItem('efc_local_data');
        if (saved) {
            this.localData = { ...this.localData, ...JSON.parse(saved) };
        }
    }

    saveLocalData() {
        localStorage.setItem('efc_local_data', JSON.stringify(this.localData));
    }

    // Methods to manage local data alongside Google Sheets
    addCustomRace(raceData) {
        if (!this.localData.races) this.localData.races = [];
        this.localData.races.push({
            id: 'custom_' + Date.now(),
            ...raceData,
            isCustom: true
        });
        this.saveLocalData();
    }

    addCustomCircuit(circuitData) {
        const circuitId = circuitData.id || 'circuit_' + Date.now();
        this.localData.circuits[circuitId] = {
            ...circuitData,
            isCustom: true
        };
        this.saveLocalData();
        return circuitId;
    }

    // Get combined data (Google Sheets + local)
    getCombinedCircuits() {
        const sheetsCircuits = window.raceCalendar ? window.raceCalendar.circuitData : {};
        return { ...sheetsCircuits, ...this.localData.circuits };
    }

    getCombinedRaces() {
        const calendarRaces = window.raceCalendar ? window.raceCalendar.races : [];
        return [...calendarRaces, ...(this.localData.races || [])];
    }

    // Export/import functionality
    exportAllLocalData() {
        return {
            circuits: this.localData.circuits,
            races: this.localData.races,
            news: this.localData.news,
            customData: this.localData.customData,
            exportDate: new Date().toISOString()
        };
    }

    importLocalData(data) {
        this.localData = { ...this.localData, ...data };
        this.saveLocalData();
        return true;
    }
}

// Initialize when loaded
window.DataManager = DataManager;
window.dataManager = new DataManager();