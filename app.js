import { joinRoom } from 'trystero';

// Game state management
let room = null;
let myPeerId = null;
let myName = '';
let isAdmin = false;
let currentRoomCode = '';
let phaseTimer = null;

// Initial game state
let gameState = {
    currentPhase: 'dare-suggestion',
    roundNumber: 1,
    players: [],
    dareSubmissions: {},
    dareVotes: {},
    winningDare: null,
    originatorGuesses: {},
    darePerformer: null,
    settings: {
        dareVotingAnonymous: true,
        allowVoteForOwnDare: true,
        originatorGuessingAnonymous: true,
        allowVoteForSelfOriginator: false,
        roundTimer: 0
    }
};

// DOM Elements
const splashScreen = document.getElementById('splash-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const errorMessage = document.getElementById('error-message');
const roomCodeDisplay = document.getElementById('room-code-display');
const copyLinkBtn = document.getElementById('copy-link-btn');
const phaseDisplay = document.getElementById('phase-display');
const timerDisplay = document.getElementById('timer-display');
const playersList = document.getElementById('players-list');
const adminPanel = document.getElementById('admin-panel');
const forceAdvanceBtn = document.getElementById('force-advance-btn');

// Phase views
const dareSuggestionView = document.getElementById('dare-suggestion-view');
const dareVotingView = document.getElementById('dare-voting-view');
const originatorGuessingView = document.getElementById('originator-guessing-view');
const revealView = document.getElementById('reveal-view');

// Utility functions
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showError(message) {
    errorMessage.textContent = message;
    setTimeout(() => {
        errorMessage.textContent = '';
    }, 3000);
}

function getPhaseDisplayName(phase) {
    const phaseNames = {
        'dare-suggestion': 'Phase 1: Dare Suggestion',
        'dare-voting': 'Phase 2: Dare Voting',
        'originator-guessing': 'Phase 3: Originator Guessing',
        'reveal': 'Phase 4: The Reveal'
    };
    return phaseNames[phase] || phase;
}

// Room management
function createRoom() {
    const name = playerNameInput.value.trim();
    if (!name) {
        showError('Please enter your name');
        return;
    }

    myName = name;
    currentRoomCode = generateRoomCode();
    isAdmin = true;
    
    connectToRoom(currentRoomCode);
}

function joinRoomHandler() {
    const name = playerNameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    
    if (!name) {
        showError('Please enter your name');
        return;
    }
    
    if (!code) {
        showError('Please enter a room code');
        return;
    }

    myName = name;
    currentRoomCode = code;
    isAdmin = false;
    
    connectToRoom(code);
}

function connectToRoom(roomCode) {
    // Use a stable app ID that works across different domains
    const appId = 'who-dares-game';
    console.log('Connecting to room:', roomCode, 'as', isAdmin ? 'admin' : 'player', 'with appId:', appId);
    
    try {
        room = joinRoom({ appId }, roomCode);
        console.log('Room created:', room);
        
        // Set up room actions first
        setupRoomActions();
        console.log('Room actions set up');
    } catch (error) {
        console.error('Error connecting to room:', error);
        showError('Failed to connect to room. Please try again.');
        return;
    }
    
    // Show game screen
    console.log('Switching to game screen');
    splashScreen.classList.remove('active');
    gameScreen.classList.add('active');
    console.log('Game screen should now be visible');
    
    // Update room code display
    roomCodeDisplay.textContent = roomCode;
    window.location.hash = roomCode;
    
    // Initialize as admin if creating room
    if (isAdmin) {
        myPeerId = 'self'; // Admin always has 'self' as ID
        gameState.players = [{
            id: 'self',
            name: myName,
            isAdmin: true
        }];
        updateUI();
        adminPanel.style.display = 'block';
    } else {
        // Non-admin needs to wait for connection and send their info
        // Wait a bit longer to ensure admin is ready
        setTimeout(() => {
            // Try to get peer ID from room
            myPeerId = room.selfId || 'pending-' + Date.now();
            console.log('Non-admin peer ID:', myPeerId);
            
            // Send player info to admin
            if (window.gameActions && window.gameActions.sendPlayerInfo) {
                console.log('Sending player info:', { name: myName });
                window.gameActions.sendPlayerInfo({ name: myName });
            } else {
                console.error('Game actions not ready yet');
            }
        }, 1000);
    }
}

function setupRoomActions() {
    // Actions for players to send to admin
    const [sendDare, getDare] = room.makeAction('dare');
    const [sendDareVote, getDareVote] = room.makeAction('dareVote');
    const [sendOriginatorGuess, getOriginatorGuess] = room.makeAction('guess');
    const [sendPlayerInfo, getPlayerInfo] = room.makeAction('playerInfo');
    const [sendChoosePerformer, getChoosePerformer] = room.makeAction('choose');
    
    // Admin broadcasts state
    const [sendState, getState] = room.makeAction('state');
    
    // Admin actions
    const [sendKick, getKick] = room.makeAction('kick');
    
    // Handle peer join
    room.onPeerJoin((peerId) => {
        console.log('Peer joined:', peerId);
        if (isAdmin) {
            // Send current game state to new peer
            setTimeout(() => {
                sendState(gameState, peerId);
            }, 500);
        }
    });
    
    // Handle peer leave
    room.onPeerLeave((peerId) => {
        if (isAdmin) {
            gameState.players = gameState.players.filter(p => p.id !== peerId);
            broadcastState();
        }
    });
    
    // Player sends their info when joining
    // This is now handled in connectToRoom after getting peer ID
    
    // Admin receives player info
    if (isAdmin) {
        getPlayerInfo((data, peerId) => {
            console.log('Admin received player info:', data, 'from peer:', peerId);
            
            const existingPlayer = gameState.players.find(p => p.name === data.name && p.id !== 'self');
            
            if (existingPlayer) {
                // Player rejoining with same name - update their peer ID
                existingPlayer.id = peerId;
                console.log('Updated existing player ID');
            } else {
                // New player
                const newPlayer = {
                    id: peerId,
                    name: data.name,
                    isAdmin: false
                };
                gameState.players.push(newPlayer);
                console.log('Added new player:', newPlayer);
            }
            
            broadcastState();
        });
    }
    
    // Receive state updates
    getState((newState, peerId) => {
        console.log('Received state update from:', peerId);
        gameState = newState;
        
        // For non-admin players, find their peer ID in the player list
        if (!isAdmin && myName) {
            const myPlayer = gameState.players.find(p => p.name === myName && !p.isAdmin);
            if (myPlayer && myPlayer.id) {
                myPeerId = myPlayer.id;
                console.log('Updated my peer ID from game state:', myPeerId);
            }
        }
        
        updateUI();
    });
    
    // Handle dare submission
    if (isAdmin) {
        getDare((data, peerId) => {
            gameState.dareSubmissions[peerId] = {
                submitted: true,
                dare: data.dare
            };
            checkPhaseCompletion();
            broadcastState();
        });
    }
    
    // Handle dare vote
    if (isAdmin) {
        getDareVote((data, peerId) => {
            gameState.dareVotes[peerId] = {
                votedForDareFrom: data.votedForDareFrom
            };
            checkPhaseCompletion();
            broadcastState();
        });
    }
    
    // Handle originator guess
    if (isAdmin) {
        getOriginatorGuess((data, peerId) => {
            gameState.originatorGuesses[peerId] = {
                guessedPlayerId: data.guessedPlayerId
            };
            checkPhaseCompletion();
            broadcastState();
        });
    }
    
    // Handle performer choice
    if (isAdmin) {
        getChoosePerformer((data, peerId) => {
            if (gameState.winningDare && gameState.winningDare.submitterId === peerId) {
                gameState.darePerformer = data.performerId;
                broadcastState();
            }
        });
    }
    
    // Handle kick
    getKick((data) => {
        if (data.kickedId === myPeerId || data.kickedId === 'self') {
            window.location.reload();
        }
    });
    
    // Store action functions for later use
    window.gameActions = {
        sendDare,
        sendDareVote,
        sendOriginatorGuess,
        sendPlayerInfo,
        sendChoosePerformer,
        sendState,
        sendKick
    };
}

function broadcastState() {
    if (isAdmin && window.gameActions && room) {
        // Broadcast to all connected peers
        const peers = room.getPeers();
        console.log('Broadcasting state to peers:', peers);
        // getPeers returns an object, so we need to iterate over its keys
        Object.keys(peers).forEach(peerId => {
            window.gameActions.sendState(gameState, peerId);
        });
        // Also update admin's own UI
        updateUI();
    }
}

function checkPhaseCompletion() {
    if (!isAdmin) return;
    
    const activePlayers = gameState.players.filter(p => p.id);
    let shouldAdvance = false;
    
    switch (gameState.currentPhase) {
        case 'dare-suggestion':
            const submissions = Object.keys(gameState.dareSubmissions).length;
            shouldAdvance = submissions >= activePlayers.length;
            break;
            
        case 'dare-voting':
            const votes = Object.keys(gameState.dareVotes).length;
            shouldAdvance = votes >= activePlayers.length;
            break;
            
        case 'originator-guessing':
            const guesses = Object.keys(gameState.originatorGuesses).length;
            shouldAdvance = guesses >= activePlayers.length;
            break;
    }
    
    if (shouldAdvance) {
        advancePhase();
    }
}

function advancePhase() {
    if (!isAdmin) return;
    
    clearPhaseTimer();
    
    switch (gameState.currentPhase) {
        case 'dare-suggestion':
            gameState.currentPhase = 'dare-voting';
            break;
            
        case 'dare-voting':
            // Calculate winning dare before moving to guessing phase
            calculateWinningDare();
            gameState.currentPhase = 'originator-guessing';
            break;
            
        case 'originator-guessing':
            // Calculate if originator was guessed correctly
            calculateOriginatorGuessResult();
            gameState.currentPhase = 'reveal';
            break;
            
        case 'reveal':
            // Start new round
            startNewRound();
            break;
    }
    
    startPhaseTimer();
    broadcastState();
}

function calculateWinningDare() {
    const voteCount = {};
    
    // Count votes
    Object.values(gameState.dareVotes).forEach(vote => {
        const dareFrom = vote.votedForDareFrom;
        voteCount[dareFrom] = (voteCount[dareFrom] || 0) + 1;
    });
    
    // Find max votes
    let maxVotes = 0;
    let winners = [];
    
    Object.entries(voteCount).forEach(([playerId, votes]) => {
        if (votes > maxVotes) {
            maxVotes = votes;
            winners = [playerId];
        } else if (votes === maxVotes) {
            winners.push(playerId);
        }
    });
    
    // Handle no votes case
    if (winners.length === 0) {
        winners = Object.keys(gameState.dareSubmissions);
    }
    
    // Random selection if tie
    const winnerId = winners[Math.floor(Math.random() * winners.length)];
    
    gameState.winningDare = {
        submitterId: winnerId,
        dare: gameState.dareSubmissions[winnerId].dare
    };
}

function calculateOriginatorGuessResult() {
    const guessCount = {};
    
    // Count guesses
    Object.values(gameState.originatorGuesses).forEach(guess => {
        const guessedId = guess.guessedPlayerId;
        guessCount[guessedId] = (guessCount[guessedId] || 0) + 1;
    });
    
    // Find most guessed
    let maxGuesses = 0;
    let mostGuessed = [];
    
    Object.entries(guessCount).forEach(([playerId, guesses]) => {
        if (guesses > maxGuesses) {
            maxGuesses = guesses;
            mostGuessed = [playerId];
        } else if (guesses === maxGuesses) {
            mostGuessed.push(playerId);
        }
    });
    
    // Random selection if tie
    const guessedId = mostGuessed[Math.floor(Math.random() * mostGuessed.length)];
    
    // Check if correct
    if (guessedId === gameState.winningDare.submitterId) {
        // Originator was guessed correctly - they perform the dare
        gameState.darePerformer = gameState.winningDare.submitterId;
    } else {
        // Originator was not guessed - they choose who performs
        gameState.darePerformer = null; // Will be set when originator chooses
    }
}

function startNewRound() {
    gameState.currentPhase = 'dare-suggestion';
    gameState.roundNumber++;
    gameState.dareSubmissions = {};
    gameState.dareVotes = {};
    gameState.winningDare = null;
    gameState.originatorGuesses = {};
    gameState.darePerformer = null;
}

function startPhaseTimer() {
    if (!isAdmin || gameState.settings.roundTimer === 0) return;
    
    let timeLeft = gameState.settings.roundTimer;
    
    phaseTimer = setInterval(() => {
        timeLeft--;
        
        if (timeLeft <= 0) {
            clearPhaseTimer();
            advancePhase();
        } else {
            // Broadcast time update
            gameState.timeLeft = timeLeft;
            broadcastState();
        }
    }, 1000);
}

function clearPhaseTimer() {
    if (phaseTimer) {
        clearInterval(phaseTimer);
        phaseTimer = null;
    }
}

// UI Update functions
function updateUI() {
    console.log('Updating UI with game state:', gameState);
    updatePhaseDisplay();
    updatePlayersList();
    updatePhaseView();
    updateTimer();
}

function updatePhaseDisplay() {
    phaseDisplay.textContent = getPhaseDisplayName(gameState.currentPhase);
}

function updateTimer() {
    if (gameState.timeLeft && gameState.settings.roundTimer > 0) {
        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        timerDisplay.style.display = 'block';
    } else {
        timerDisplay.style.display = 'none';
    }
}

function updatePlayersList() {
    playersList.innerHTML = '';
    
    gameState.players.forEach(player => {
        const li = document.createElement('li');
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        nameSpan.textContent = player.name;
        
        // Check if this player is me
        const isMe = (isAdmin && player.id === 'self') || (!isAdmin && player.id === myPeerId);
        
        if (isMe) {
            nameSpan.textContent += ' (You)';
        }
        
        // Debug logging
        if (!isAdmin && player.name === myName) {
            console.log('Player comparison:', { 
                playerName: player.name, 
                myName: myName, 
                playerId: player.id, 
                myPeerId: myPeerId,
                isMe: isMe 
            });
        }
        
        if (player.isAdmin) {
            const adminBadge = document.createElement('span');
            adminBadge.className = 'admin-badge';
            adminBadge.textContent = 'Admin';
            nameSpan.appendChild(adminBadge);
        }
        
        li.appendChild(nameSpan);
        
        // Add kick button for admin (but not for themselves)
        if (isAdmin && !isMe) {
            const kickBtn = document.createElement('button');
            kickBtn.className = 'kick-btn';
            kickBtn.textContent = 'Kick';
            kickBtn.onclick = () => kickPlayer(player.id);
            li.appendChild(kickBtn);
        }
        
        playersList.appendChild(li);
    });
}

function kickPlayer(playerId) {
    if (!isAdmin) return;
    
    gameState.players = gameState.players.filter(p => p.id !== playerId);
    window.gameActions.sendKick({ kickedId: playerId });
    broadcastState();
}

function updatePhaseView() {
    // Hide all views
    dareSuggestionView.style.display = 'none';
    dareVotingView.style.display = 'none';
    originatorGuessingView.style.display = 'none';
    revealView.style.display = 'none';
    
    // Show current phase view
    switch (gameState.currentPhase) {
        case 'dare-suggestion':
            updateDareSuggestionView();
            break;
        case 'dare-voting':
            updateDareVotingView();
            break;
        case 'originator-guessing':
            updateOriginatorGuessingView();
            break;
        case 'reveal':
            updateRevealView();
            break;
    }
}

function updateDareSuggestionView() {
    dareSuggestionView.style.display = 'block';
    
    const myId = isAdmin ? 'self' : myPeerId;
    const hasSubmitted = gameState.dareSubmissions[myId]?.submitted;
    
    const dareInput = document.getElementById('dare-input');
    const submitBtn = document.getElementById('submit-dare-btn');
    const waitingMsg = dareSuggestionView.querySelector('.waiting-message');
    
    if (hasSubmitted) {
        dareInput.style.display = 'none';
        submitBtn.style.display = 'none';
        waitingMsg.style.display = 'block';
        
        // Update submission status
        updateSubmissionStatus('dare-submission-status');
    } else {
        dareInput.style.display = 'block';
        submitBtn.style.display = 'block';
        waitingMsg.style.display = 'none';
    }
}

function updateDareVotingView() {
    dareVotingView.style.display = 'block';
    
    const myId = isAdmin ? 'self' : myPeerId;
    const hasVoted = gameState.dareVotes[myId] !== undefined;
    
    const dareCards = document.getElementById('dare-cards');
    const waitingMsg = dareVotingView.querySelector('.waiting-message');
    
    if (hasVoted) {
        dareCards.style.display = 'none';
        waitingMsg.style.display = 'block';
        updateSubmissionStatus('dare-voting-status');
    } else {
        dareCards.style.display = 'grid';
        waitingMsg.style.display = 'none';
        
        // Display dare cards
        dareCards.innerHTML = '';
        
        Object.entries(gameState.dareSubmissions).forEach(([playerId, submission]) => {
            // Check if this is my dare
            const isMyDare = (isAdmin && playerId === 'self') || 
                           (!isAdmin && gameState.players.find(p => p.id === playerId)?.name === myName);
            
            if (!gameState.settings.allowVoteForOwnDare && isMyDare) {
                return;
            }
            
            const card = document.createElement('div');
            card.className = 'dare-card';
            card.textContent = submission.dare;
            
            // Show live voting if enabled
            if (!gameState.settings.dareVotingAnonymous) {
                const voteCount = Object.values(gameState.dareVotes)
                    .filter(v => v.votedForDareFrom === playerId).length;
                
                if (voteCount > 0) {
                    const countSpan = document.createElement('span');
                    countSpan.className = 'vote-count';
                    countSpan.textContent = voteCount;
                    card.appendChild(countSpan);
                }
                
                const voters = gameState.players
                    .filter(p => gameState.dareVotes[p.id]?.votedForDareFrom === playerId)
                    .map(p => p.name);
                
                if (voters.length > 0) {
                    const voterList = document.createElement('div');
                    voterList.className = 'voter-list';
                    voterList.textContent = voters.join(', ');
                    card.appendChild(voterList);
                }
            }
            
            card.onclick = () => voteDare(playerId);
            dareCards.appendChild(card);
        });
    }
}

function updateOriginatorGuessingView() {
    originatorGuessingView.style.display = 'block';
    
    const myId = isAdmin ? 'self' : myPeerId;
    const hasGuessed = gameState.originatorGuesses[myId] !== undefined;
    
    const winningDareText = document.getElementById('winning-dare-text');
    winningDareText.textContent = gameState.winningDare.dare;
    
    const playerCards = document.getElementById('player-guess-cards');
    const waitingMsg = originatorGuessingView.querySelector('.waiting-message');
    
    if (hasGuessed) {
        playerCards.style.display = 'none';
        waitingMsg.style.display = 'block';
        updateSubmissionStatus('originator-guessing-status');
    } else {
        playerCards.style.display = 'grid';
        waitingMsg.style.display = 'none';
        
        // Display player cards
        playerCards.innerHTML = '';
        
        gameState.players.forEach(player => {
            // Check if this player is me
            const isMe = (isAdmin && player.id === 'self') || 
                        (!isAdmin && player.name === myName);
            
            if (!gameState.settings.allowVoteForSelfOriginator && isMe) {
                return;
            }
            
            const card = document.createElement('div');
            card.className = 'player-card';
            card.textContent = player.name;
            
            // Show live guessing if enabled
            if (!gameState.settings.originatorGuessingAnonymous) {
                const guessCount = Object.values(gameState.originatorGuesses)
                    .filter(g => g.guessedPlayerId === player.id).length;
                
                if (guessCount > 0) {
                    const countSpan = document.createElement('span');
                    countSpan.className = 'vote-count';
                    countSpan.textContent = guessCount;
                    card.appendChild(countSpan);
                }
            }
            
            card.onclick = () => guessOriginator(player.id);
            playerCards.appendChild(card);
        });
    }
}

function updateRevealView() {
    revealView.style.display = 'block';
    
    const revealDareText = document.getElementById('reveal-dare-text');
    revealDareText.textContent = gameState.winningDare.dare;
    
    const revealResults = document.getElementById('reveal-results');
    const dareAssignment = document.getElementById('dare-assignment');
    const originatorChoice = document.getElementById('originator-choice');
    
    // Show who submitted the dare
    const originator = gameState.players.find(p => p.id === gameState.winningDare.submitterId);
    revealResults.innerHTML = `<p>This dare was submitted by: <strong>${originator.name}</strong></p>`;
    
    // Show voting results
    const guessCount = {};
    Object.values(gameState.originatorGuesses).forEach(guess => {
        guessCount[guess.guessedPlayerId] = (guessCount[guess.guessedPlayerId] || 0) + 1;
    });
    
    const votingResults = gameState.players
        .map(p => `${p.name}: ${guessCount[p.id] || 0} votes`)
        .join(', ');
    
    revealResults.innerHTML += `<p>Voting results: ${votingResults}</p>`;
    
    // Handle dare assignment
    const myId = isAdmin ? 'self' : myPeerId;
    
    if (gameState.darePerformer) {
        // Someone has been assigned
        const performer = gameState.players.find(p => p.id === gameState.darePerformer);
        dareAssignment.innerHTML = `<strong>${performer.name}</strong> must perform the dare!`;
        dareAssignment.style.display = 'block';
        originatorChoice.style.display = 'none';
    } else if (gameState.winningDare.submitterId === myId) {
        // I'm the originator and need to choose
        dareAssignment.style.display = 'none';
        originatorChoice.style.display = 'block';
        
        const choiceCards = document.getElementById('choice-player-cards');
        choiceCards.innerHTML = '';
        
        gameState.players.forEach(player => {
            if (player.id === myId) return;
            
            const card = document.createElement('div');
            card.className = 'player-card';
            card.textContent = player.name;
            card.onclick = () => choosePerformer(player.id);
            choiceCards.appendChild(card);
        });
    } else {
        // Waiting for originator to choose
        dareAssignment.innerHTML = 'Waiting for the dare creator to choose who performs it...';
        dareAssignment.style.display = 'block';
        originatorChoice.style.display = 'none';
    }
}

function updateSubmissionStatus(elementId) {
    const statusDiv = document.getElementById(elementId);
    statusDiv.innerHTML = '';
    
    let field;
    switch (elementId) {
        case 'dare-submission-status':
            field = 'dareSubmissions';
            break;
        case 'dare-voting-status':
            field = 'dareVotes';
            break;
        case 'originator-guessing-status':
            field = 'originatorGuesses';
            break;
    }
    
    gameState.players.forEach(player => {
        const span = document.createElement('span');
        span.className = 'player-status';
        
        const hasActed = gameState[field][player.id] !== undefined;
        span.className += hasActed ? ' submitted' : ' pending';
        span.textContent = player.name;
        
        statusDiv.appendChild(span);
    });
}

// Game actions
function submitDare() {
    const dareInput = document.getElementById('dare-input');
    const dare = dareInput.value.trim();
    
    if (!dare) {
        showError('Please enter a dare');
        return;
    }
    
    const myId = isAdmin ? 'self' : myPeerId;
    
    if (isAdmin) {
        gameState.dareSubmissions[myId] = {
            submitted: true,
            dare: dare
        };
        checkPhaseCompletion();
        broadcastState();
    } else {
        // Send to admin
        window.gameActions.sendDare({ dare });
        // Update local UI immediately to show waiting state
        gameState.dareSubmissions[myId] = { submitted: true, dare: dare };
        updateUI();
    }
}

function voteDare(dareFromId) {
    const myId = isAdmin ? 'self' : myPeerId;
    
    if (isAdmin) {
        gameState.dareVotes[myId] = {
            votedForDareFrom: dareFromId
        };
        checkPhaseCompletion();
        broadcastState();
    } else {
        window.gameActions.sendDareVote({ votedForDareFrom: dareFromId });
        // Update local UI immediately
        gameState.dareVotes[myId] = { votedForDareFrom: dareFromId };
        updateUI();
    }
}

function guessOriginator(playerId) {
    const myId = isAdmin ? 'self' : myPeerId;
    
    if (isAdmin) {
        gameState.originatorGuesses[myId] = {
            guessedPlayerId: playerId
        };
        checkPhaseCompletion();
        broadcastState();
    } else {
        window.gameActions.sendOriginatorGuess({ guessedPlayerId: playerId });
        // Update local UI immediately
        gameState.originatorGuesses[myId] = { guessedPlayerId: playerId };
        updateUI();
    }
}

function choosePerformer(playerId) {
    const myId = isAdmin ? 'self' : myPeerId;
    
    if (isAdmin) {
        gameState.darePerformer = playerId;
        broadcastState();
    } else {
        window.gameActions.sendChoosePerformer({ performerId: playerId });
    }
}

// Event listeners
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoomHandler);
document.getElementById('submit-dare-btn').addEventListener('click', submitDare);
forceAdvanceBtn.addEventListener('click', () => {
    if (isAdmin) {
        advancePhase();
    }
});

// Copy room link
copyLinkBtn.addEventListener('click', () => {
    const url = window.location.origin + window.location.pathname + '#' + currentRoomCode;
    navigator.clipboard.writeText(url).then(() => {
        copyLinkBtn.textContent = '✓';
        setTimeout(() => {
            copyLinkBtn.textContent = '📋';
        }, 2000);
    });
});

// Settings listeners
document.getElementById('dare-voting-anonymity').addEventListener('change', (e) => {
    if (isAdmin) {
        gameState.settings.dareVotingAnonymous = e.target.value === 'anonymous';
        broadcastState();
    }
});

document.getElementById('vote-own-dare').addEventListener('change', (e) => {
    if (isAdmin) {
        gameState.settings.allowVoteForOwnDare = e.target.value === 'allow';
        broadcastState();
    }
});

document.getElementById('originator-guessing-anonymity').addEventListener('change', (e) => {
    if (isAdmin) {
        gameState.settings.originatorGuessingAnonymous = e.target.value === 'anonymous';
        broadcastState();
    }
});

document.getElementById('vote-self-originator').addEventListener('change', (e) => {
    if (isAdmin) {
        gameState.settings.allowVoteForSelfOriginator = e.target.value === 'allow';
        broadcastState();
    }
});

document.getElementById('round-timer').addEventListener('change', (e) => {
    if (isAdmin) {
        gameState.settings.roundTimer = parseInt(e.target.value);
        clearPhaseTimer();
        if (gameState.settings.roundTimer > 0) {
            startPhaseTimer();
        }
        broadcastState();
    }
});

// Check for room code in URL hash
window.addEventListener('load', () => {
    const hash = window.location.hash.substring(1);
    if (hash) {
        roomCodeInput.value = hash;
    }
});

// Handle Enter key
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (roomCodeInput.value) {
            joinRoomHandler();
        } else {
            createRoom();
        }
    }
});

roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoomHandler();
    }
});

document.getElementById('dare-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitDare();
    }
}); 