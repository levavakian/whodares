import React from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { api } from './api'
import { Room, Phases } from './Elements'

interface InteractionProps {
    room?: Room
    name: string
}

interface InteractionState {
    suggestion: string
}

class Interaction extends React.Component<InteractionProps,InteractionState> {
    constructor(props: InteractionProps) {
      super(props)
      this.state = {
        suggestion: ""
      }
    }

    doPing = (evt: any) => {
        api("POST", "ping", {"code": this.props.room?.code, "name": this.props.name}, (e: any) => {
            if (e.target.response?.error) {
            toast(e.target.response.error)
            }
        })
    }

    doRestart = (evt: any) => {
        const code = this.props.room?.code
        const phase = this.props.room?.board.phase
        const name = this.props.name
        api("POST", "input", {"player": name, "code": code, phase: phase}, (e: any) => {
            if (e.target.status !== 201) {
                toast(e.target.response.error)
                return
            }
        })  
    }

    makePing() {
        if (!this.props.room) {
            return <span>Waiting for room...</span>
        }

        if (this.props.room.board.phase === Phases.Finished) {
            return <span className="cardanim buttonlist">The game has ended</span>
        }

        return <span onClick={this.doPing} className="cardanim buttonlist">Ping</span>
    }

    makeReset() {
        if (!this.props.room || !(this.props.room.board.phase === Phases.Finished)) {
            return <></>
        }
        return <span className="cardanim buttonlist" onClick={this.doRestart}>Restart Game</span>
    }

    onSuggestionChange = (event: any) => {
        this.setState((prevState) => {
          return {
            suggestion: event.target.value
          }
        })
    }

    onSuggest = (event: any) => {
        api("POST", "input", {"code": this.props.room?.code, "player": this.props.name, "entry": this.state.suggestion, "phase": this.props.room?.board.phase}, (e: any) => {
          if (e.target.status !== 201) {
            toast(e.target.response?.error)
            return
          }
          this.setState((prevState) => {
            return {
              suggestion: ""
            }
          })
        })
    }

    hash = (str: string): number => {
        var h: number = 0;
        for (var i = 0; i < str.length; i++) {
            h = 31 * h + str.charCodeAt(i);
        }
        return h & 0xFFFFFFFF
    }

    compareStrHash = (a: string, b: string): number => {
        return this.hash(a) - this.hash(b)
    }

    renderSuggestionPhase() {
        var have_submitted = false
        let ds = this.props.room?.board.dare_suggestions || {}
        let dp = this.props.room?.players || []
        let n_sub = Object.keys(ds).length
        let n_players =dp.length
        for (let key in this.props.room?.board.dare_suggestions) {
            if (key === this.props.name) {
                have_submitted = true
                break
            }
        }

        return (
            <div>
                <div>{n_sub}/{n_players} submitted</div>
                {have_submitted ? <span>You have submitted but you can submit again!</span> : <span></span>}
                <div className="Flexrow">
                    <input className="Wide" value={this.state.suggestion} onChange={this.onSuggestionChange} placeholder="suggestion"></input>
                    <span onClick={this.onSuggest} className="cardanim buttonlist">Suggest</span>
                </div>
            </div>
        )
    }

    onSelect = (event: any, entry: string) => {
        api("POST", "input", {"code": this.props.room?.code, "player": this.props.name, "entry": entry, "phase": this.props.room?.board.phase}, (e: any) => {
          if (e.target.status !== 201) {
            toast(e.target.response?.error)
            return
          }
        })
    }

    renderDareVotingPhase() {
        let dv = this.props.room?.board.dare_votes || {}
        let ds = this.props.room?.board.dare_suggestions || {}
        let dares = Object.values(ds).sort(this.compareStrHash)
        var selected = ""
        for (let key in dv) {
            if (key === this.props.name) {
                selected = dv[key]
                break
            }
        }
        let selected_cls = "cardanim buttonlist selected"
        let unselected_cls = "cardanim buttonlist"
        let frag0 = <div key="info">Vote on which dare you would like to see happen</div>
        let frag1 = <div key="dv-len">{Object.keys(dv).length}/{this.props.room?.players.length} have voted</div>
        let frag2 = dares.map((inp) => <div key={"suggestion" + inp} className={inp === selected ? selected_cls : unselected_cls} onClick={(ev: any) => {this.onSelect(ev, inp)}}>{inp}</div>);
        return [frag0, frag1, frag2]
    }

    getActiveDare = ():string => {
        let dv = this.props.room?.board.dare_votes || {}
        var dare_to_vote: { [id: string]: number } = {}
        for (let key in dv) {
            if (dare_to_vote[dv[key]] === undefined) {
                dare_to_vote[dv[key]] = 0
            }
            dare_to_vote[dv[key]]++
        }
        var selected_dare = ""
        var max_vote = 0
        for (let key in dare_to_vote) {
            if (dare_to_vote[key] > max_vote) {
                max_vote = dare_to_vote[key]
                selected_dare = key
            }
        }
        return selected_dare
    }

    getVotedPerson = ():string => {
        let pv = this.props.room?.board.people_votes || {}
        var person_to_vote: { [id: string]: number } = {}
        for (let key in pv) {
            if (person_to_vote[pv[key]] === undefined) {
                person_to_vote[pv[key]] = 0
            }
            person_to_vote[pv[key]]++
        }
        var selected_person = ""
        var max_vote = 0
        for (let key in person_to_vote) {
            if (person_to_vote[key] > max_vote) {
                max_vote = person_to_vote[key]
                selected_person = key
            }
        }
        return selected_person
    }

    getTrueAuthor = ():string => {
        let active = this.getActiveDare()
        let ds = this.props.room?.board.dare_suggestions || {}
        for (let key in ds) {
            if (ds[key] === active) {
                return key
            }
        }
        return ""
    }

    renderPeopleVotingPhase() {
        let ds = this.props.room?.board.dare_suggestions || {}
        let pv = this.props.room?.board.people_votes || {}
        let selected_dare = this.getActiveDare()

        // Get which person we've voted for already if any
        var selected = ""
        for (let key in pv) {
            if (key === this.props.name) {
                selected = pv[key]
                break
            }
        }

        let selected_cls = "cardanim buttonlist selected"
        let unselected_cls = "cardanim buttonlist"
        let frag0 = <div key="info">Vote on who you think came up with this dare: {selected_dare}</div>
        let frag1 = <div key="dv-len">{Object.keys(pv).length}/{this.props.room?.players.length} have voted</div>
        let frag2 = Object.keys(ds).map((inp) => <div key={"suggestion" + inp} className={inp === selected ? selected_cls : unselected_cls} onClick={(ev: any) => {this.onSelect(ev, inp)}}>{inp}</div>);
        return [frag0, frag1, frag2]
    } 

    renderFinalPhase() {
        let dare = this.getActiveDare()
        let voted = this.getVotedPerson()
        let author = this.getTrueAuthor()

        if (voted === author) {
            return ([
                <div>The author of the dare was discovered: {author} must now do the dare</div>,
                <div>{dare}</div>
            ])
        } else {
            return ([
                <div>The author was {author}, bu {voted} was chosen instead. {author} can choose who must do the dare now</div>,
                <div>{dare}</div>
            ])
        }
    }

    renderPhase() {
        let phase = this.props.room?.board.phase
        if (phase === Phases.SuggestionPhase) {
            return this.renderSuggestionPhase()
        }

        if (phase === Phases.DareVotingPhase) {
            return this.renderDareVotingPhase()
        }

        if (phase === Phases.PeopleVotingPhase) {
            return this.renderPeopleVotingPhase()
        }

        return this.renderFinalPhase()
    }

    render() {
        return (
          <div className="Flexcolumn">
            <div className="Flexrow">
              {this.makePing()}
              {this.makeReset()}
            </div>
            {this.renderPhase()}
          </div>
        )
      }
}

export default Interaction;