'use strict';

import 'babel-polyfill';
import {takeEvery, takeLatest, delay} from 'redux-saga';
import {
  call,
  put,
  select,
  actionChannel,
  take,
  fork
} from 'redux-saga/effects';
import {get as getUser, search as searchUsers, likeAdd} from '../lib/vk/api/user';
import actions from '../actions';
import rp from 'request-promise';
import config from '../../config.json';

let _access_token;

function* get_user(action) {
  try {
    const user = yield call(getUser, action.query_params);
    yield put(actions.get_user_resolved(user));
  } catch (error) {
    yield put(actions.get_user_rejected(error));
  }
}

export const get_query_params = state => state.search_criteria.toJS();

const get_access_token = (function () {
  let _token;

  return function* (reset = false) {
    if (!_token || reset) {
      try {
        _token = yield call(rp, config.server_endpoint);
      } catch (err) {
        yield put(actions.access_token_rejected(err));
      }
    }

    yield put(actions.access_token_resolved(_token));
  };
})();

function* search_users() {
  try {
    yield call(get_access_token);
    const query_params = yield select(get_query_params);
    const data = yield call(searchUsers, query_params);
    yield put(actions.search_users_resolved(data));
  } catch (error) {
    yield put(actions.search_users_rejected(error));
  }
}


function* like_add(user) {
  try {
    yield call(likeAdd, user, _access_token);
    yield put(actions.like_add_resolved());
  } catch (error) {
    yield put(actions.like_add_rejected(error));
  }
}

function* handleLikesAddition() {
  const likesAddChannel = yield actionChannel(actions.types.LIKE_ADD);

  while(true) {
    let action = yield take(likesAddChannel);
    yield fork(like_add, action.user);
    action = yield take([
      actions.types.LIKE_ADD_RESOLVED,
      actions.types.LIKE_ADD_REJECTED
    ]);

    yield [
      action,
      call(delay, 1000)
    ];

    if (action.type === actions.types.LIKE_ADD_REJECTED) {
      console.log(action.error);
      yield call(delay, 3000);
    } else {
      console.log('like');
    }
  }
}

function* saga() {
  _access_token = yield select(state => state.access_token);

  yield [
    takeEvery(actions.types.GET_USER, get_user),
    call(handleLikesAddition),
    takeLatest(actions.types.SEARCH_USERS, search_users)
  ];
}


export {get_user, get_access_token};
export default saga;