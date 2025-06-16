# Who Dares - A Peer-to-Peer Dare Game

## 1. Project Overview

Who Dares is an online, multiplayer dare game designed to be played with friends. The game operates without a backend server, utilizing WebRTC for real-time, peer-to-peer communication. All game logic and state are managed directly by the clients in a room.

The project's core constraint is simplicity in deployment. It must be a static web application (composed of `index.html`, `app.js`, and `style.css`) that can be hosted on any static hosting service like GitHub Pages, with no build tools or compilation steps required.

## 2. Core Technologies

-   **HTML/CSS/JavaScript**: The foundation of the web application.
-   **Trystero**: A lightweight JavaScript library that simplifies WebRTC peer-to-peer connections. It will be used for all communication between players, including game state synchronization. It should be included via a CDN link in `index.html`.

## 3. Deployment

The application will be a single-page application. To deploy, simply upload the `index.html`, `app.js`, and `style.css` files to a static web hosting provider.

## 4. Game Flow

The game is played in rounds, with each round consisting of four distinct phases. The game progresses from one phase to the next only when all players have completed the required action for the current phase, or when the room's Admin decides to force-advance it.

### Round Structure

1.  **Phase 1: Dare Suggestion**
    -   Each player is prompted to anonymously submit a dare.
    -   Submissions are hidden until the next phase.

2.  **Phase 2: Dare Voting**
    -   All submitted dares are revealed.
    -   Players vote for the dare they want to see performed.
    -   If there is a tie, a winning dare is chosen randomly from the tied entries.

3.  **Phase 3: Originator Guessing**
    -   The winning dare is announced.
    -   Players now vote on who they believe submitted that winning dare.

4.  **Phase 4: The Reveal & Dare Assignment**
    -   The results of the originator vote are revealed, along with the true originator of the dare.
    -   **If the originator was guessed correctly** (received the most votes, with ties being randomly decided), they are instructed to perform the dare themselves.
    -   **If the originator was NOT guessed correctly**, they get to choose another player to perform the dare.
    -   After a player is assigned the dare and completes it in real life, the Admin advances the game, and a new round begins, returning to Phase 1.

## 5. Key Features & Rules

### Room Management

-   **Creating a Room**: A player provides a name and clicks "Create Room". They are made the Admin of the newly created room, which has a unique, shareable room code.
-   **Joining a Room**: A player provides a name and the room code. Alternatively, they can use a shareable URL (`https://your-game-host.com#ROOM_CODE`) which pre-fills the room code.
-   **Player List**: A list of all players in the room is always visible.
-   **Room Code**: The room code is always visible, with a button to copy the shareable URL to the clipboard.
-   **Disconnects**:
    -   If the **Admin** disconnects, a new Admin is randomly assigned from the remaining players.
    -   If a **player** disconnects and rejoins with the exact same name during the same round they submitted a dare, they re-assume ownership of that dare.
    -   Players with identical names are treated as the same player entity.

### Admin Controls

The Admin has a special control panel with the following capabilities:
-   **Force Advance**: Move the game to the next phase, even if not all players have acted.
-   **Kick Player**: Remove a player from the room.
-   **Settings**: Configure game rules.

### Settings Panel

The Admin can change the following settings, which are applied to all subsequent rounds:

| Setting                         | Options                  | Default      | Description                                                                 |
| ------------------------------- | ------------------------ | ------------ | --------------------------------------------------------------------------- |
| **Dare Voting Anonymity**       | Anonymous / Live         | Anonymous    | "Live" shows who is voting for which dare in real-time.                     |
| **Vote for Own Dare**           | Allow / Disallow         | Allow        | Allows or prevents players from voting for their own dare submission.       |
| **Originator Guessing Anonymity** | Anonymous / Live         | Anonymous    | "Live" shows who is voting for whom in real-time.                           |
| **Vote for Self as Originator** | Allow / Disallow         | Disallow     | Allows or prevents players from voting for themselves as the originator.    |
| **Round Timers**                | None / 5s / 30s / 1m / 5m  | None         | If set, applies a timer to each phase of the round.                         |

## 6. UI/Component Design

The application should be broken down into logical components to manage complexity.

-   **`App`**: The main container component that manages the overall game state and which screen/view is currently active.
-   **`SplashScreen`**: The initial view.
    -   Input for Player Name.
    -   Input for Room Code.
    -   "Create Room" and "Join Room" buttons.
-   **`GameScreen`**: The main view once inside a room.
    -   **`PersistentHeader`**: Displays the game title, room code (with copy button), and the title of the current game phase.
    -   **`PlayerList`**: A sidebar listing all connected players. The Admin will see a "Kick" button next to each name.
    -   **`GamePhaseView`**: A central panel whose content changes based on the current game phase. It will render one of the following:
        -   `DareSuggestionView`: A text input and "Submit" button.
        -   `DareVotingView`: A list of dare cards to click on and vote for.
        -   `OriginatorGuessingView`: A list of player names to click on and vote for.
        -   `RevealView`: Displays the results and the final dare assignment. Includes an animation for random tie-breaking.
    -   **`AdminPanel`**: A section visible only to the Admin, containing the "Force Advance" button and the settings controls.

## 7. State Management (Peer-to-Peer)

Since there is no central server, the game state must be synchronized across all connected peers.

-   **Source of Truth**: The Admin's client holds the authoritative game state.
-   **State Synchronization**:
    -   When a non-admin player performs an action (e.g., submits a dare, casts a vote), they send an event to the Admin.
    -   The Admin validates the action, updates the central `gameState` object, and then **broadcasts the entire new `gameState`** to all players in the room.
    -   All clients receive the new state and re-render their UI accordingly. This ensures everyone is always in sync with the Admin.

### Example `gameState` Object:

```javascript
const gameState = {
  currentPhase: 'dare-suggestion', // 'dare-suggestion', 'dare-voting', 'originator-guessing', 'reveal'
  roundNumber: 1,
  players: [
    // { id: 'peer-id-1', name: 'Alice', isAdmin: true },
    // { id: 'peer-id-2', name: 'Bob', isAdmin: false }
  ],
  dareSubmissions: {
    // 'peer-id-1': { submitted: true, dare: 'I dare you to...' },
    // 'peer-id-2': { submitted: false, dare: null }
  },
  dareVotes: {
    // 'peer-id-1': { votedForDareFrom: 'peer-id-2' }
  },
  winningDare: {
    // submitterId: 'peer-id-2',
    // dare: 'I dare you to...'
  },
  originatorGuesses: {
    // 'peer-id-1': { guessedPlayerId: 'peer-id-2' }
  },
  settings: {
    dareVotingAnonymous: true,
    allowVoteForOwnDare: true,
    originatorGuessingAnonymous: true,
    allowVoteForSelfOriginator: false,
    roundTimer: 0 // 0 for no timer, otherwise in seconds
  }
};
```

## 8. Implementation Plan for a Junior Engineer

Follow these steps to build the application:

1.  **Step 1: Basic Setup**
    -   Create `index.html`, `style.css`, and `app.js`.
    -   In `index.html`, add the Trystero library from a CDN: `<script src="https://unpkg.com/trystero/dist/trystero.min.js"></script>`.
    -   Lay out the basic HTML structure for the `SplashScreen` and `GameScreen` (you can hide the `GameScreen` initially).

2.  **Step 2: Room Connection**
    -   In `app.js`, implement the logic for the `SplashScreen`.
    -   Use `Trystero` to create and join rooms. Use the hash from the URL (`window.location.hash`) for the room code.
    -   On successful connection, hide the `SplashScreen` and show the `GameScreen`.

3.  **Step 3: Player and Admin Sync**
    -   Implement the `PlayerList`. Use `Trystero`'s `onPeerJoin` and `onPeerLeave` events to keep the list synchronized.
    -   The first person to create the room is the Admin. Implement the logic to pass the Admin role to another player if the current Admin leaves.

4.  **Step 4: Game State Machine**
    -   Define the `gameState` object as specified above.
    -   Create actions in `Trystero` for players to send data to the Admin (e.g., `submitDare`, `castVote`).
    -   Create a broadcast action for the Admin (`updateGameState`) that sends the entire state object to all clients.
    -   Implement a handler on the client side that updates the UI whenever a new `gameState` is received.

5.  **Step 5: Build Game Phases**
    -   Implement the UI and logic for each of the four game phases (`DareSuggestionView`, `DareVotingView`, etc.).
    -   Use the `gameState.currentPhase` property to determine which view to display.
    -   Ensure that player actions correctly call the `Trystero` actions to notify the Admin.

6.  **Step 6: Implement Admin Controls**
    -   Build the `AdminPanel` UI, making it visible only if the current player is the Admin.
    -   Implement the "Force Advance" button to progress the `currentPhase`.
    -   Implement the settings controls, which update the `gameState.settings` object.
    -   Implement the "Kick Player" functionality.

7.  **Step 7: Refine and Polish**
    -   Add CSS to make the game look and feel good.
    -   Add small animations for events like random tie-breaking to improve the user experience.
    -   Test all edge cases: players joining/leaving at different phases, Admin leaving, etc.
    -   Ensure the copy-to-clipboard functionality for the room link works correctly.

