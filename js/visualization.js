// Canvas setup
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// World state
const worldState = {
    weather: 'sunny',
    timeOfDay: 'day',
    season: 'spring',
    temperature: 20,
    humidity: 0.5
};

// Faction system
const factions = new Map();
const factionColors = {
    merchants: '#4CAF50',
    nobles: '#9C27B0',
    guards: '#2196F3',
    cultists: '#FF5722'
};

// NPC and environment state
const npcs = [];
const places = [];
const events = [];

class NPC {
    constructor(x, y) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.speed = 2;
        this.emotions = {
            happiness: 0.5,
            fear: 0,
            energy: 0.8,
            comfort: 0.5
        };
        this.needs = {
            social: Math.random(),
            rest: Math.random(),
            safety: Math.random()
        };
        this.faction = null;
        this.relationships = new Map();
        this.personality = {
            openness: Math.random(),
            extraversion: Math.random(),
            agreeableness: Math.random()
        };
    }

    update() {
        // Move towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
            this.x += (dx / dist) * this.speed;
            this.y += (dy / dist) * this.speed;
        } else {
            this.pickNewTarget();
        }

        // Update needs
        this.needs.social = Math.max(0, this.needs.social - 0.001);
        this.needs.rest = Math.max(0, this.needs.rest - 0.001);
        this.needs.safety = Math.max(0, this.needs.safety - 0.001);

        // React to weather
        this.reactToWeather();

        // React to time of day
        this.reactToTimeOfDay();

        // Update emotions based on environment
        this.updateEmotions();

        // Consider joining/leaving factions
        if (!this.faction && Math.random() < 0.001) {
            // Consider joining a faction
            const nearbyPlaces = places.filter(place => 
                place.controlledBy && 
                Math.hypot(this.x - place.x, this.y - place.y) < place.influence
            );
            
            if (nearbyPlaces.length > 0) {
                const place = nearbyPlaces[Math.floor(Math.random() * nearbyPlaces.length)];
                if (Math.random() < this.personality.openness) {
                    this.joinFaction(place.controlledBy);
                }
            }
        } else if (this.faction && Math.random() < 0.0001) {
            // Consider leaving faction
            if (Math.random() > this.personality.agreeableness) {
                this.leaveFaction();
            }
        }
    }

    reactToWeather() {
        switch (worldState.weather) {
            case 'sunny':
                this.emotions.happiness += 0.001;
                this.emotions.energy += 0.001;
                break;
            case 'rainy':
                this.emotions.comfort -= 0.001;
                this.emotions.energy -= 0.001;
                break;
            case 'stormy':
                this.emotions.fear += 0.002;
                this.emotions.comfort -= 0.002;
                this.needs.safety -= 0.002;
                break;
        }
    }

    reactToTimeOfDay() {
        if (worldState.timeOfDay === 'night') {
            this.needs.rest -= 0.002;
            this.emotions.energy -= 0.001;
        } else {
            this.emotions.energy += 0.001;
        }
    }

    updateEmotions() {
        // Clamp emotions between 0 and 1
        for (let emotion in this.emotions) {
            this.emotions[emotion] = Math.max(0, Math.min(1, this.emotions[emotion]));
        }
    }

    pickNewTarget() {
        // Find most pressing need
        const lowestNeed = Object.entries(this.needs)
            .reduce((a, b) => a[1] < b[1] ? a : b);

        // Choose destination based on need
        let destinations = places.filter(p => {
            switch (lowestNeed[0]) {
                case 'social':
                    return ['tavern', 'marketplace', 'plaza'].includes(p.type);
                case 'rest':
                    return ['garden', 'temple'].includes(p.type);
                case 'safety':
                    return ['temple', 'library'].includes(p.type);
                default:
                    return true;
            }
        });

        // Consider faction territories
        if (this.faction) {
            const factionPlaces = places.filter(p => p.controlledBy === this.faction);
            destinations = [...destinations, ...factionPlaces];
        }

        if (destinations.length > 0) {
            const destination = destinations[Math.floor(Math.random() * destinations.length)];
            this.targetX = destination.x;
            this.targetY = destination.y;
        } else {
            this.targetX = Math.random() * canvas.width;
            this.targetY = Math.random() * canvas.height;
        }
    }

    draw() {
        // Draw NPC
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = this.faction ? factionColors[this.faction] : '#000';
        ctx.fill();

        // Draw emotion indicator
        const emotionHeight = 3;
        const emotionWidth = 20;
        ctx.fillStyle = `rgb(
            ${Math.floor(255 * (1 - this.emotions.happiness))},
            ${Math.floor(255 * this.emotions.happiness)},
            0)`;
        ctx.fillRect(
            this.x - emotionWidth/2,
            this.y - 10,
            emotionWidth * this.emotions.happiness,
            emotionHeight
        );

        // Draw faction indicator
        if (this.faction) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = factionColors[this.faction];
            ctx.stroke();
        }
    }

    joinFaction(type) {
        // Leave current faction if any
        if (this.faction) {
            const oldFaction = factions.get(this.faction);
            if (oldFaction) {
                oldFaction.members.delete(this);
            }
        }
        
        // Join new faction
        this.faction = type;
        const faction = factions.get(type);
        if (faction) {
            faction.members.add(this);
            
            // Try to claim nearby unclaimed places
            places.forEach(place => {
                if (!place.controlledBy) {
                    const nearbyMembers = Array.from(faction.members)
                        .filter(member => 
                            Math.hypot(member.x - place.x, member.y - place.y) < place.influence
                        ).length;
                    
                    if (nearbyMembers > 0) {
                        place.controlledBy = type;
                        faction.territory.add(place);
                    }
                }
            });
        }
        
        updateFactionPanel();
    }

    leaveFaction() {
        if (this.faction) {
            const faction = factions.get(this.faction);
            if (faction) {
                faction.members.delete(this);
                
                // Remove control of places if no members nearby
                Array.from(faction.territory).forEach(place => {
                    const nearbyMembers = Array.from(faction.members)
                        .filter(member => 
                            Math.hypot(member.x - place.x, member.y - place.y) < place.influence
                        ).length;
                    
                    if (nearbyMembers === 0) {
                        place.controlledBy = null;
                        faction.territory.delete(place);
                    }
                });
            }
            this.faction = null;
            updateFactionPanel();
        }
    }
}

class Place {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.controlledBy = null;
        this.influence = 30;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
        ctx.strokeStyle = this.controlledBy ? factionColors[this.controlledBy] : '#666';
        ctx.stroke();

        // Draw influence zone
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.influence, 0, Math.PI * 2);
        ctx.fillStyle = `${this.controlledBy ? factionColors[this.controlledBy] : '#666'}22`;
        ctx.fill();

        // Draw icon based on type
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.type[0].toUpperCase(), this.x, this.y + 4);
    }
}

class Event {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.duration = 300;
        this.radius = 50;
        this.participants = new Set();
        this.factions = new Set();
        this.effects = this.getEventEffects();
    }

    getEventEffects() {
        const effects = {
            celebration: {
                emotions: { happiness: 0.002, comfort: 0.001 },
                needs: { social: 0.001 },
                factionRelations: 0.001
            },
            conflict: {
                emotions: { fear: 0.002, comfort: -0.001 },
                needs: { safety: -0.002 },
                factionRelations: -0.002
            },
            trade: {
                emotions: { happiness: 0.001 },
                needs: { social: 0.001 },
                factionRelations: 0.002
            },
            performance: {
                emotions: { happiness: 0.001, comfort: 0.001 },
                needs: { social: 0.001 },
                factionRelations: 0.001
            }
        };
        return effects[this.type] || effects.celebration;
    }

    update() {
        this.duration--;
        
        // Affect nearby NPCs
        npcs.forEach(npc => {
            const dx = npc.x - this.x;
            const dy = npc.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < this.radius) {
                // Add NPC to participants
                this.participants.add(npc);
                if (npc.faction) {
                    this.factions.add(npc.faction);
                }
                
                // Apply emotional effects
                Object.entries(this.effects.emotions).forEach(([emotion, value]) => {
                    npc.emotions[emotion] = Math.max(0, Math.min(1,
                        npc.emotions[emotion] + value * npc.personality.openness
                    ));
                });
                
                // Apply need effects
                Object.entries(this.effects.needs).forEach(([need, value]) => {
                    npc.needs[need] = Math.max(0, Math.min(1,
                        npc.needs[need] + value
                    ));
                });
            }
        });
        
        // Update faction relations
        if (this.factions.size > 1) {
            const factionArray = Array.from(this.factions);
            for (let i = 0; i < factionArray.length; i++) {
                for (let j = i + 1; j < factionArray.length; j++) {
                    const faction1 = factions.get(factionArray[i]);
                    const faction2 = factions.get(factionArray[j]);
                    if (faction1 && faction2) {
                        const currentRelation = faction1.relations.get(factionArray[j]) || 0;
                        const newRelation = Math.max(-1, Math.min(1,
                            currentRelation + this.effects.factionRelations
                        ));
                        faction1.relations.set(factionArray[j], newRelation);
                        faction2.relations.set(factionArray[i], newRelation);
                    }
                }
            }
            updateFactionPanel();
        }
    }

    draw() {
        // Draw event area
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.getEventColor();
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.stroke();

        // Draw event type
        ctx.font = '14px Arial';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText(this.type, this.x, this.y);
        
        // Draw participating faction indicators
        if (this.factions.size > 0) {
            const angle = (Math.PI * 2) / this.factions.size;
            Array.from(this.factions).forEach((faction, index) => {
                const x = this.x + Math.cos(angle * index) * (this.radius + 10);
                const y = this.y + Math.sin(angle * index) * (this.radius + 10);
                
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fillStyle = factionColors[faction];
                ctx.fill();
            });
        }
    }

    getEventColor() {
        switch (this.type) {
            case 'celebration':
                return '#FFD70022';
            case 'conflict':
                return '#FF000022';
            case 'trade':
                return '#00FF0022';
            case 'performance':
                return '#0000FF22';
            default:
                return '#FFD70022';
        }
    }
}

function createFaction(type) {
    if (!factions.has(type)) {
        const faction = {
            members: new Set(),
            territory: new Set(),
            relations: new Map()
        };
        
        // Set initial relationships with existing factions
        factions.forEach((otherFaction, otherType) => {
            // Merchants and nobles are neutral
            // Guards are positive with merchants and nobles
            // Cultists are negative with everyone
            let relationship = 0;
            
            if (type === 'cultists' || otherType === 'cultists') {
                relationship = -0.6;
            } else if (type === 'guards') {
                relationship = 0.3;
            }
            
            faction.relations.set(otherType, relationship);
            otherFaction.relations.set(type, relationship);
        });
        
        factions.set(type, faction);
        
        // Try to claim nearby unclaimed places
        places.forEach(place => {
            if (!place.controlledBy) {
                const nearbyMembers = npcs.filter(npc => 
                    npc.faction === type && 
                    Math.hypot(npc.x - place.x, npc.y - place.y) < place.influence
                ).length;
                
                if (nearbyMembers > 0) {
                    place.controlledBy = type;
                    faction.territory.add(place);
                }
            }
        });
        
        updateFactionPanel();
    }
}

function updateFactionPanel() {
    const factionList = document.getElementById('factionList');
    factionList.innerHTML = '';
    
    factions.forEach((faction, type) => {
        const li = document.createElement('li');
        li.className = 'faction-item';
        
        // Create relationship display
        const relationships = Array.from(faction.relations.entries())
            .map(([otherType, value]) => `${otherType}: ${value.toFixed(1)}`)
            .join(', ');
        
        li.innerHTML = `
            <span>${type}</span>
            <span>Members: ${faction.members.size}</span>
            <span>Territory: ${faction.territory.size}</span>
            <div class="faction-relations">Relations: ${relationships}</div>
        `;
        factionList.appendChild(li);
    });
}

function updateWorldPanel() {
    const worldPanel = document.getElementById('worldPanel');
    const storylineInfo = document.getElementById('storylineInfo');
    
    if (narrativeAgent.currentStoryline) {
        const storyline = narrativeAgent.currentStoryline;
        const currentPhase = storyline.phases[narrativeAgent.storyPhase] || storyline.phases[storyline.phases.length - 1];
        
        storylineInfo.innerHTML = `
            <h4>Current Story: ${storyline.title}</h4>
            <div>Progress: ${Math.floor(narrativeAgent.storylineProgress * 100)}%</div>
            <div>Phase: ${currentPhase.type} (${currentPhase.count} events needed)</div>
            <div class="story-progress">
                <div class="progress-bar" style="width: ${narrativeAgent.storylineProgress * 100}%"></div>
            </div>
        `;
    } else {
        storylineInfo.innerHTML = '<div>No active storyline</div>';
    }
}

function addNPC() {
    const npc = new NPC(
        Math.random() * canvas.width,
        Math.random() * canvas.height
    );
    npcs.push(npc);
}

function addPlace(type) {
    const place = new Place(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        type
    );
    places.push(place);
}

function setWeather(type) {
    worldState.weather = type;
    updateWorldPanel();
}

function toggleDayNight() {
    worldState.timeOfDay = worldState.timeOfDay === 'day' ? 'night' : 'day';
    updateWorldPanel();
}

function nextSeason() {
    const seasons = ['spring', 'summer', 'fall', 'winter'];
    const currentIndex = seasons.indexOf(worldState.season);
    worldState.season = seasons[(currentIndex + 1) % seasons.length];
    updateWorldPanel();
}

function triggerEvent(type) {
    const event = new Event(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        type
    );
    events.push(event);
    
    // Log event
    const eventLog = document.getElementById('eventLog');
    const eventDiv = document.createElement('div');
    eventDiv.textContent = `New ${type} event started!`;
    eventLog.insertBefore(eventDiv, eventLog.firstChild);
}

function clearAll() {
    npcs.length = 0;
    places.length = 0;
    events.length = 0;
    factions.clear();
    updateFactionPanel();
}

// Initialize narrative agent
let narrativeAgent;

function updateCurrentEventDisplay() {
    const currentEventDiv = document.getElementById('currentEvent');
    const activeEvents = events.filter(e => e.duration > 0);
    
    if (activeEvents.length > 0) {
        // Sort events by number of participants
        activeEvents.sort((a, b) => b.participants.size - a.participants.size);
        const event = activeEvents[0];
        
        let html = `
            <div class="event-details">
                <h4>${event.type.charAt(0).toUpperCase() + event.type.slice(1)}</h4>
                <div>Duration: ${Math.ceil(event.duration / 60)} seconds</div>
                <div>Participants: ${event.participants.size}</div>
                <div class="event-participants">
        `;
        
        // Add participant indicators
        event.participants.forEach(npc => {
            html += `
                <div class="participant-dot" style="background-color: ${
                    npc.faction ? factionColors[npc.faction] : '#666'
                }" title="${
                    npc.faction ? `Member of ${npc.faction}` : 'Independent'
                }"></div>
            `;
        });
        
        html += '</div>';
        
        // Add faction information if there are factions involved
        if (event.factions.size > 0) {
            html += '<div class="event-factions">';
            event.factions.forEach(faction => {
                const participantsInFaction = Array.from(event.participants)
                    .filter(npc => npc.faction === faction).length;
                html += `
                    <div class="faction-dot">
                        <div class="participant-dot" style="background-color: ${
                            factionColors[faction]
                        }"></div>
                        <span>${faction}: ${participantsInFaction}</span>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        html += '</div>';
        currentEventDiv.innerHTML = html;
    } else {
        currentEventDiv.innerHTML = '<div class="event-details">No active events</div>';
    }
}

// Game loop (removing duplicate update calls)
function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update narrative agent
    narrativeAgent.update(npcs, places, events, factions);
    
    // Update and draw places
    places.forEach(place => place.draw());
    
    // Update and draw NPCs
    npcs.forEach(npc => {
        npc.update();
        npc.draw();
    });
    
    // Update and draw events
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        event.update();
        event.draw();
        if (event.duration <= 0) {
            events.splice(i, 1);
        }
    }
    
    // Update UI panels
    updateFactionPanel();
    updateWorldPanel();
    updateCurrentEventDisplay();
    
    // Update stats
    document.getElementById('npcCount').textContent = npcs.length;
    document.getElementById('placeCount').textContent = places.length;
    document.getElementById('eventCount').textContent = events.length;
    document.getElementById('factionCount').textContent = factions.size;
    
    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Initialize factions
function initializeFactions() {
    createFaction('merchants');
    createFaction('nobles');
    createFaction('guards');
    createFaction('cultists');
}

// Initialize places
function initializePlaces() {
    const placeTypes = ['tavern', 'marketplace', 'temple', 'plaza', 'garden', 'library'];
    for (let i = 0; i < 6; i++) {
        addPlace(placeTypes[i]);
    }
}

// Initialize NPCs
function initializeNPCs() {
    for (let i = 0; i < 15; i++) {
        addNPC();
    }
}

// Initialize everything when the window loads
window.onload = function() {
    console.log('Initializing visualization...');
    
    // Create narrative agent first
    narrativeAgent = new NarrativeAgent();
    console.log('Narrative agent created');
    
    // Initialize core systems
    initializeFactions();
    console.log('Factions initialized:', factions.size);
    
    initializePlaces();
    console.log('Places initialized:', places.length);
    
    initializeNPCs();
    console.log('NPCs initialized:', npcs.length);
    
    // Initial UI update
    updateFactionPanel();
    updateWorldPanel();
    updateCurrentEventDisplay();
    
    console.log('Starting game loop...');
    // Start the game loop
    gameLoop();
    
    // Update world state periodically
    setInterval(() => {
        // Change weather randomly
        if (Math.random() < 0.001) {
            const weathers = ['sunny', 'rainy', 'stormy'];
            setWeather(weathers[Math.floor(Math.random() * weathers.length)]);
        }
        
        // Change time of day
        if (Math.random() < 0.0005) {
            toggleDayNight();
        }
        
        // Change season
        if (Math.random() < 0.0001) {
            nextSeason();
        }
    }, 1000);
    
    // Generate events periodically
    setInterval(() => {
        if (Math.random() < 0.1) {
            const eventTypes = ['celebration', 'conflict', 'trade', 'performance'];
            triggerEvent(eventTypes[Math.floor(Math.random() * eventTypes.length)]);
        }
    }, 5000);
    
    console.log('Initialization complete!');
};

// Add CSS for story progress bar
const style = document.createElement('style');
style.textContent = `
    .story-progress {
        width: 100%;
        height: 10px;
        background-color: #eee;
        border-radius: 5px;
        margin-top: 5px;
    }
    
    .progress-bar {
        height: 100%;
        background-color: #4CAF50;
        border-radius: 5px;
        transition: width 0.3s ease-in-out;
    }
`;
document.head.appendChild(style); 