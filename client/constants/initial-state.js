// Constants
import * as readerThemes from 'constants/reader-themes';
import { RECENTLY_OPENED } from './views';

export default {
  drawer: false, toasts: [], view: RECENTLY_OPENED, save: '',
  books: [],
  account: {
    uid: 0, email: '', subscription: 0, library: '', librarySizeLimit: 15,
    referral: {}, xyAnnotationsKey: ''
  },
  config: {
    general: {
      theme: 'light'
    },
    bookList: {
      view: 'compact',
      table: {
        columns: [
          'title', 'authors', 'series', 'added', 'rating'
        ],
        defaultSort: {
          column: 'title', asc: true
        }
      }
    },
    reader: Object.assign({}, readerThemes.LIGHT, {
      fontSize: 1.2, padding: 1, lineHeight: 1.4, defaultHighlightMode: 'none'
    })
  },
  search: {
    query: '', page: 1
  }
};