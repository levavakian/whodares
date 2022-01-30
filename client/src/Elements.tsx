enum Phases {
  SuggestionPhase = 0,
  DareVotingPhase = 1,
  PeopleVotingPhase = 2,
  Finished = 3,
}

class Player {
  name: string;

  constructor(props: any) {
    this.name = props.name
  }
}

class GameBoard {
  phase: number;
  dare_suggestions: {[id: string] : string; }
  dare_votes: {[id: string] : string; }
  people_votes: {[id: string] : string; }

  constructor(props: any) {
    this.phase = props.phase
    
    let dare_suggestions_tmp: { [id: string]: string } = {};
    for (let key in props.dare_suggestions) {
      dare_suggestions_tmp[key] = props.dare_suggestions[key]
    }
    this.dare_suggestions = dare_suggestions_tmp

    let dare_votes_tmp: { [id: string]: string } = {};
    for (let key in props.dare_votes) {
      dare_votes_tmp[key] = props.dare_votes[key]
    }
    this.dare_votes = dare_votes_tmp

    let people_votes_tmp: { [id: string]: string } = {};
    for (let key in props.people_votes) {
      people_votes_tmp[key] = props.people_votes[key]
    }
    this.people_votes = people_votes_tmp
  }
}

class Action {
  player: string;
  index: number;
  code: string;
  reset: boolean;

  constructor(props: any) {
    this.player = props.player
    this.index = props.index
    this.code = props.code
    this.reset = props.reset
  }
}

class Room {
  code: string;
  board: GameBoard;
  players: Player[];

  constructor(props: any) {
    this.code = props.code
    this.board = new GameBoard(props.board)
    this.players = []
    for (let jsonplayer of props.players) {
      this.players.push(new Player(jsonplayer))
    }
  }
}

const getPlayerNames = (room: Room) => {
  let player_names = new Array<string>(room.players.length)
  for (let i = 0; i < room.players.length; i++) {
    player_names[i] = "Player " + (i+1).toString()
    if (i < room.players.length) {
      player_names[i] = room.players[i].name
    }
  }
  return player_names
}

export { Room, Player, GameBoard, Action, getPlayerNames, Phases }