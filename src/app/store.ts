import { configureStore, ThunkAction, Action } from '@reduxjs/toolkit';
import gameReducer from '../features/game/gameSlice'
import showReducer from '../features/show/showSlice'

export const store = configureStore({
  reducer: {
    game: gameReducer,
    show: showReducer
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
