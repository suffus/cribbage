import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../../app/store';
import { GameStage } from '../../app/game'
import { Suit, Rank } from '../../app/entities'
import { thePlayer } from '../../app/gamePlayer'

type Score = {
  recipient : "player" | "opponent" | "none"
  score: number
}

export type PCard = {suit: Suit, rank: Rank}

export type UserGamePlay = {
  action: "cut" | "play-card" | "discard" | "start-round" | "new-game" | "round-end" | "noop" | "quit"
  cards : Array<PCard>
}

export type GamePeg = {
  track: number
  points: number[]
}

export interface GamePlayingState {
  message: string
  gameStage : GameStage
  nextScheduledAction : number
  showCrib : boolean
  showPlayer : boolean
  showOpponent : boolean
  autoPlay: boolean
  scoreAction : Score
  userAction : UserGamePlay
  playerPeg: GamePeg
  opponentPeg: GamePeg
  updateId: number

  status: 'idle' | 'loading' | 'failed';
}

export const initialState: GamePlayingState = {
  message: "",
  gameStage : "starting",
  nextScheduledAction : 0,
  showCrib : false,
  showPlayer: false,
  showOpponent: false,
  scoreAction: {recipient: "none", score: 0},
  userAction: { action: "noop", cards: [] },
  autoPlay: false,
  playerPeg: {track: 0, points: [0,-1,-1]},
  opponentPeg: {track: 1, points: [0,-1,-1]},
  updateId: 1,
  status: 'idle',
};

export const gameSlice = createSlice({
  name: 'game',
  initialState,
  // The `reducers` field lets us define reducers and generate associated actions
  reducers: {
    // Use the PayloadAction type to declare the contents of `action.payload`
    userPlay: (state : GamePlayingState, action: PayloadAction<UserGamePlay>) => {
      //console.log( "In reducer", action.payload )
      const updates = thePlayer.playAction( state, action.payload )
      return {...state, ...updates}
    },
    updateGameState: (state, update: PayloadAction<GamePlayingState>) => {
      return {...state, ...update}
    },
  },
  // extraReducers: ( builder ) => {
  //   builder
  //     .addCase(playGameThunk.pending, (state) => {
  //       state.status = 'loading';
  //     })
  //     .addCase(playGameThunk.fulfilled, (state, action) => {
  //       state.status = 'idle';
  //       state.actions = action.payload;
  //     });
  // },

});

export const { userPlay, updateGameState } = gameSlice.actions
export const selectState = (state: RootState) => state.game;
export default gameSlice.reducer
