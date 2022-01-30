package main

import (
	"github.com/gorilla/websocket"
	"errors"
	"sync"
)

const (
	SuggestionPhase int = 0
	DareVotingPhase = 1
	PeopleVotingPhase = 2
	FinishedPhase = 3
)

type Settings struct {
	VoteOwnDare bool `json:"vote_own_dare"`
	VoteSelf bool `json:"vote_self"`
	AnonymousDareVoting bool `json:"anonymous_dare_voting"`
	AnonymousPersonVoting bool `json:"anonymous_person_voting"`
}

type GameBoard struct {
	Phase int `json:"phase"`
	DareSuggestions map[string]string `json:"dare_suggestions"`
	DareVotes map[string]string `json:"dare_votes"`
	PeopleVotes map[string]string `json:"people_votes"`
}

type Action struct {
	Code string `json:"code"`
	Player string `json:"player"`
	Phase int `json:"phase"`
	Entry string `json:"entry"`
	ForceContinue bool `json:"force_continue"`
}

type Player struct {
	Name string `json:"name"`
	Conns map[*websocket.Conn]bool `json:"-"`
}

type Room struct {
	sync.RWMutex
	Code string `json:"code"`
	Players []*Player `json:"players"`
	Board *GameBoard `json:"board"`
	Settings Settings `json:"settings"`
}

func NewRoom(code string) (*Room, error) {
	return &Room{
		Code: code,
		Board: NewBoard(),
		Players: []*Player{},
		Settings: Settings{},
	}, nil
}

func (r *Room) PlayerFromName(name string) (*Player, int) {
	for idx, player := range r.Players {
		if player.Name == name {
			return player, idx
		}
	}
	return nil, 0
}

func (r *Room) PlayerFromIndex(index int) (*Player, string) {
	if index < 0 || index >= len(r.Players) {
		return nil, ""
	}
	return r.Players[index], r.Players[index].Name
}

func (b *GameBoard) GetPhaseStorage() map[string]string {
	if b.Phase == 0 {
		return b.DareSuggestions
	}
	if b.Phase == 1 {
		return b.DareVotes
	}
	if b.Phase == 2 {
		return b.PeopleVotes
	}
	return nil
} 

func (r *Room) WaitingForInput(p *Player) bool {
	storage := r.Board.GetPhaseStorage()
	if storage == nil {
		return false
	}
	_, ok := storage[p.Name]
	return !ok
}

func (r *Room) WaitingForAnyInputs() bool {
	for _, p := range r.Players {
		if r.WaitingForInput(p) {
			return true
		}
	}
	return false
}

func (r *Room) Reset() {
	r.Board = NewBoard()
}

func NewBoard() *GameBoard {
	b := &GameBoard{
		Phase: 0,
		DareSuggestions: make(map[string]string),
		DareVotes: make(map[string]string),
		PeopleVotes: make(map[string]string),
	}
	return b
}

func (r *Room) DoAction(a *Action) error {
	if a.Phase != r.Board.Phase {
		return errors.New("Action submitted with stale state")
	}
	p, _ := r.PlayerFromName(a.Player)
	if p == nil {
		return errors.New("No such player in lobby")
	}

	// Finish game or force advance to next phase in case people have dropped
	if (a.ForceContinue || r.Board.Phase == FinishedPhase) {
		r.Board.Phase++
		if r.Board.Phase > FinishedPhase {
			r.Reset()
		}
		return nil
	}

	// Phase 1
	if (r.Board.Phase == SuggestionPhase) {
		if a.Entry == "" {
			return errors.New("must provide a dare suggestion in suggestion phase")
		}
		r.Board.DareSuggestions[p.Name] = a.Entry
	}

	// Phase 2
	if (r.Board.Phase == DareVotingPhase) {
		found := func()bool{
			for _, v := range r.Board.DareSuggestions {
				if v == a.Entry {
					return true
				}
			}
			return false
		}()
		if !found {
			return errors.New("could not find chosen dare to vote for")
		}
		r.Board.DareVotes[p.Name] = a.Entry
	}

	// Phase 3
	if (r.Board.Phase == PeopleVotingPhase) {
		voted, _ := r.PlayerFromName(a.Entry)
		if voted == nil {
			return errors.New("could not find chosen player to vote for")
		}
		r.Board.PeopleVotes[p.Name] = a.Entry
	}

	// Continue to next phase
	if !r.WaitingForAnyInputs() && len(r.Players) > 0 {
		r.Board.Phase++
	}

	return nil
}