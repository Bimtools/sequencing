import {createStore,applyMiddleware} from 'redux';
import createSagaMiddleware from '@redux-saga/core';
import logger from 'redux-logger';
import rootReducer from "./rootReducer";
import rootSaga from "./rootSaga";
import { composeWithDevTools } from '@redux-devtools/extension';

const sagaMiddleware= createSagaMiddleware();

const store = createStore(rootReducer,composeWithDevTools((applyMiddleware(sagaMiddleware,logger))));

sagaMiddleware.run(rootSaga);

export default store;