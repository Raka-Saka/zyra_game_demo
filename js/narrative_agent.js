class NarrativeAgent {
    constructor() {
        this.storylineProgress = 0;
        this.lastEventTime = 0;
        this.eventCooldown = 180; // 3 seconds between events
        this.npcSpawnCooldown = 120; // 2 seconds between NPC spawns
        this.placeSpawnCooldown = 300; // 5 seconds between place spawns
        this.lastNPCSpawnTime = 0;
        this.lastPlaceSpawnTime = 0;
        this.currentStoryline = null;
        this.storyPhase = 0;
        this.maxNPCs = 30;
        this.maxPlacesPerType = 3;
    }

    update(npcs, places, events, factions) {
        this.storylineProgress += 0.001;
        const worldState = this.analyzeWorldState(npcs, places, events, factions);
        
        // Manage NPCs
        if (Date.now() - this.lastNPCSpawnTime > this.npcSpawnCooldown) {
            this.manageNPCs(npcs, places, factions, worldState);
            this.lastNPCSpawnTime = Date.now();
        }

        // Manage places
        if (Date.now() - this.lastPlaceSpawnTime > this.placeSpawnCooldown) {
            this.managePlaces(places, factions, worldState);
            this.lastPlaceSpawnTime = Date.now();
        }
        
        // Generate events
        if (Date.now() - this.lastEventTime > this.eventCooldown) {
            const newEvent = this.generateEvent(worldState);
            if (newEvent) {
                events.push(newEvent);
                this.lastEventTime = Date.now();
            }
        }
        
        // Update storyline
        this.updateStoryline(worldState);
    }

    manageNPCs(npcs, places, factions, worldState) {
        // Remove inactive NPCs
        npcs.forEach((npc, index) => {
            if (npc.emotions.energy < 0.1 || npc.needs.rest < 0.1) {
                npcs.splice(index, 1);
            }
        });

        // Add new NPCs if needed
        if (npcs.length < this.maxNPCs) {
            const spawnPoint = this.findSpawnPoint(places);
            if (spawnPoint) {
                const npc = new NPC(spawnPoint.x, spawnPoint.y);
                
                // Assign personality based on current storyline
                if (this.currentStoryline) {
                    switch (this.currentStoryline.title) {
                        case "Rising Tensions":
                            npc.personality.agreeableness = Math.random() * 0.4;
                            npc.personality.extraversion = Math.random() * 0.7 + 0.3;
                            break;
                        case "Cultural Exchange":
                            npc.personality.openness = Math.random() * 0.7 + 0.3;
                            npc.personality.agreeableness = Math.random() * 0.7 + 0.3;
                            break;
                        case "Power Struggle":
                            npc.personality.extraversion = Math.random() * 0.8 + 0.2;
                            npc.personality.openness = Math.random() * 0.4;
                            break;
                    }
                }

                // Consider faction assignment
                if (factions.size > 0 && Math.random() < 0.7) {
                    const availableFactions = Array.from(factions.keys());
                    const chosenFaction = availableFactions[Math.floor(Math.random() * availableFactions.length)];
                    npc.joinFaction(chosenFaction);
                }

                npcs.push(npc);
            }
        }
    }

    managePlaces(places, factions, worldState) {
        const placeTypes = ['tavern', 'marketplace', 'temple', 'plaza', 'garden', 'library'];
        
        // Count existing places by type
        const placeCounts = {};
        places.forEach(place => {
            placeCounts[place.type] = (placeCounts[place.type] || 0) + 1;
        });

        // Add new places if needed based on current storyline
        placeTypes.forEach(type => {
            if ((!placeCounts[type] || placeCounts[type] < this.maxPlacesPerType) && 
                this.shouldAddPlace(type, worldState)) {
                const location = this.findPlaceLocation(places);
                if (location) {
                    const place = new Place(location.x, location.y, type);
                    
                    // Assign to faction based on territory control
                    if (factions.size > 0 && Math.random() < 0.5) {
                        const dominantFaction = worldState.dominantFactions[0];
                        if (dominantFaction) {
                            place.controlledBy = dominantFaction;
                            const faction = factions.get(dominantFaction);
                            if (faction) {
                                faction.territory.add(place);
                            }
                        }
                    }
                    
                    places.push(place);
                }
            }
        });
    }

    shouldAddPlace(type, worldState) {
        if (!this.currentStoryline) return true;

        // Add places based on current storyline
        switch (this.currentStoryline.title) {
            case "Rising Tensions":
                return ['plaza', 'marketplace', 'tavern'].includes(type);
            case "Cultural Exchange":
                return ['temple', 'garden', 'marketplace'].includes(type);
            case "Power Struggle":
                return ['plaza', 'tavern', 'library'].includes(type);
            default:
                return true;
        }
    }

    findSpawnPoint(places) {
        // Try to spawn near appropriate places
        const suitablePlaces = places.filter(place => 
            ['tavern', 'marketplace', 'plaza'].includes(place.type));
        
        if (suitablePlaces.length > 0) {
            const place = suitablePlaces[Math.floor(Math.random() * suitablePlaces.length)];
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 30 + 20;
            return {
                x: place.x + Math.cos(angle) * distance,
                y: place.y + Math.sin(angle) * distance
            };
        }
        
        // Fallback to random position
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height
        };
    }

    findPlaceLocation(places) {
        const minDistance = 100; // Minimum distance between places
        let attempts = 0;
        const maxAttempts = 50;
        
        while (attempts < maxAttempts) {
            const x = Math.random() * (canvas.width - 60) + 30;
            const y = Math.random() * (canvas.height - 60) + 30;
            
            // Check distance from other places
            const tooClose = places.some(place => {
                const dx = place.x - x;
                const dy = place.y - y;
                return Math.sqrt(dx * dx + dy * dy) < minDistance;
            });
            
            if (!tooClose) {
                return { x, y };
            }
            
            attempts++;
        }
        
        return null;
    }

    analyzeWorldState(npcs, places, events, factions) {
        const state = {
            factionTensions: new Map(),
            dominantFactions: [],
            socialHotspots: [],
            activeConflicts: [],
            recentEvents: events.slice(-5)
        };
        
        // Analyze faction relationships
        if (factions.size >= 2) {
            for (const [faction1, data1] of factions) {
                for (const [faction2, data2] of factions) {
                    if (faction1 !== faction2) {
                        const relation = data1.relations.get(faction2) || 0;
                        state.factionTensions.set(`${faction1}-${faction2}`, relation);
                    }
                }
            }
        }
        
        // Find dominant factions
        const factionStrengths = new Map();
        npcs.forEach(npc => {
            if (npc.faction) {
                factionStrengths.set(npc.faction, 
                    (factionStrengths.get(npc.faction) || 0) + 1);
            }
        });
        state.dominantFactions = Array.from(factionStrengths.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(entry => entry[0]);
            
        // Identify social hotspots
        places.forEach(place => {
            const nearbyNPCs = npcs.filter(npc => {
                const dx = npc.x - place.x;
                const dy = npc.y - place.y;
                return Math.sqrt(dx * dx + dy * dy) < place.radius;
            });
            if (nearbyNPCs.length >= 3) {
                state.socialHotspots.push({
                    place,
                    npcs: nearbyNPCs
                });
            }
        });
        
        return state;
    }
    
    generateEvent(worldState) {
        if (!this.currentStoryline) {
            return null;
        }

        const eventTypes = {
            'Rising Tensions': ['dispute', 'rally', 'confrontation', 'negotiation'],
            'Cultural Exchange': ['festival', 'performance', 'ceremony', 'trade'],
            'Power Struggle': ['debate', 'election', 'conspiracy', 'alliance']
        };

        const possibleEvents = eventTypes[this.currentStoryline.title] || [];
        const eventType = possibleEvents[Math.floor(Math.random() * possibleEvents.length)];

        if (!eventType) {
            return null;
        }

        // Find suitable location for event
        const location = this.findEventLocation(worldState.socialHotspots);
        if (!location) {
            return null;
        }

        // Select participants based on event type and location
        const participants = this.selectEventParticipants(worldState, eventType, location);
        if (participants.length < 2) {
            return null;
        }

        const event = {
            type: eventType,
            location: location,
            participants: participants,
            startTime: Date.now(),
            duration: Math.random() * 10000 + 5000, // 5-15 seconds
            influence: Math.random() * 0.4 + 0.3, // 0.3-0.7
            affectedFactions: new Set(),
            progress: 0,
            update: function(delta) {
                this.progress = Math.min(1, (Date.now() - this.startTime) / this.duration);
                
                // Update participant emotions and relationships
                this.participants.forEach(participant => {
                    participant.emotions.energy -= delta * 0.1;
                    participant.emotions.mood += (Math.random() - 0.5) * delta * this.influence;
                    
                    // Update relationships between participants
                    this.participants.forEach(other => {
                        if (participant !== other) {
                            const relationshipChange = (Math.random() - 0.5) * delta * this.influence;
                            participant.updateRelationship(other, relationshipChange);
                        }
                    });
                });

                return this.progress >= 1;
            }
        };

        // Add faction effects
        participants.forEach(participant => {
            if (participant.faction) {
                event.affectedFactions.add(participant.faction);
            }
        });

        return event;
    }

    findEventLocation(socialHotspots) {
        if (socialHotspots.length > 0) {
            const hotspot = socialHotspots[Math.floor(Math.random() * socialHotspots.length)];
            return {
                x: hotspot.place.x,
                y: hotspot.place.y,
                place: hotspot.place
            };
        }
        return null;
    }

    selectEventParticipants(worldState, eventType, location) {
        const nearbyNPCs = worldState.socialHotspots.find(
            hotspot => hotspot.place === location.place
        )?.npcs || [];

        // Filter and select participants based on event type
        let participants = [];
        switch (eventType) {
            case 'dispute':
            case 'confrontation':
                // Select NPCs from different factions
                const factions = new Set(nearbyNPCs.map(npc => npc.faction).filter(Boolean));
                factions.forEach(faction => {
                    const factionalNPC = nearbyNPCs.find(npc => npc.faction === faction);
                    if (factionalNPC) participants.push(factionalNPC);
                });
                break;

            case 'festival':
            case 'performance':
                // Select NPCs with high extraversion or openness
                participants = nearbyNPCs.filter(npc => 
                    npc.personality.extraversion > 0.6 || 
                    npc.personality.openness > 0.6
                ).slice(0, 4);
                break;

            default:
                // Default selection based on proximity
                participants = nearbyNPCs.slice(0, 3);
        }

        return participants;
    }

    updateStoryline(worldState) {
        const storylines = [
            {
                title: "Rising Tensions",
                threshold: 0.3,
                check: () => {
                    const tensions = Array.from(worldState.factionTensions.values());
                    return tensions.some(tension => tension < -0.5);
                }
            },
            {
                title: "Cultural Exchange",
                threshold: 0.6,
                check: () => worldState.socialHotspots.length >= 3
            },
            {
                title: "Power Struggle",
                threshold: 0.8,
                check: () => worldState.dominantFactions.length >= 2
            }
        ];

        // Progress current storyline
        if (this.currentStoryline) {
            this.storyPhase += 0.001;
            
            // Check for storyline completion
            if (this.storyPhase >= 1) {
                this.currentStoryline = null;
                this.storyPhase = 0;
            }
        }
        
        // Select new storyline if none active
        if (!this.currentStoryline) {
            const availableStorylines = storylines.filter(storyline => 
                this.storylineProgress >= storyline.threshold && 
                storyline.check()
            );

            if (availableStorylines.length > 0) {
                this.currentStoryline = availableStorylines[
                    Math.floor(Math.random() * availableStorylines.length)
                ];
                this.storyPhase = 0;
            }
        }
    }
}

// Export the NarrativeAgent class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NarrativeAgent };
} 