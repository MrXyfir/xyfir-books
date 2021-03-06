import * as AnnotateEPUBJS from '@xyfir/annotate-epubjs';
import request from 'superagent';
import EPUB from 'epubjs';
import React from 'react';

// !! window.ePub needed for EPUBJS to work
window.ePub = window.EPUBJS = EPUB;

// Components
import Overlay from 'components/reader/overlay/Overlay';
import Modal from 'components/reader/modal/Modal';

// Modules
import updateAnnotations from 'lib/reader/annotations/update';
import highlightSearch from 'lib/reader/highlight/search';
import highlightNotes from 'lib/reader/highlight/notes';
import swipeListener from 'lib/reader/listeners/swipe';
import clickListener from 'lib/reader/listeners/click';
import openWindow from 'lib/util/open-window';
import hexToRGBA from 'lib/util/hex-to-rgba';
import loadBook from 'lib/books/load';

// Constants
import { XYLIBRARY_URL } from 'constants/config';

// Action creators
import { updateBook } from 'actions/books';
import { save } from 'actions/app';

export default class Reader extends React.Component {
  constructor(props) {
    super(props);

    const { App } = this.props;
    const id = window.location.hash.split('/')[3];

    this.state = {
      book: App.state.books.find(b => id == b.id),
      pagesLeft: 0,
      percent: 0,
      loading: true,
      history: {
        items: [],
        index: -1
      },
      modal: {
        target: '',
        show: ''
      },
      highlight: {
        mode: App.state.config.reader.defaultHighlightMode,
        index: 0,
        message: ''
      }
    };

    /**
     * @type {string[]}
     * Highlighted items clicked within the book's content.
     */
    this.clickedItems = [];

    this.onSetHighlightMode = this.onSetHighlightMode.bind(this);
    this.onHighlightClicked = this.onHighlightClicked.bind(this);
    this._addEventListeners = this._addEventListeners.bind(this);
    this._applyHighlights = this._applyHighlights.bind(this);
    this._applyFilters = this._applyFilters.bind(this);
    this.onAnchorClick = this.onAnchorClick.bind(this);
    this.onToggleShow = this.onToggleShow.bind(this);
    this.onCloseModal = this.onCloseModal.bind(this);
    this._applyStyles = this._applyStyles.bind(this);
    this._updateBook = this._updateBook.bind(this);
    this._getFilters = this._getFilters.bind(this);
    this._getStyles = this._getStyles.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onSwipe = this.onSwipe.bind(this);

    document.querySelector('body>main').id = '';
  }

  /**
   * Load / initialize book.
   */
  componentWillMount() {
    const { App } = this.props;

    loadBook(App, this.state.book)
      .then(blob => {
        // Create EPUBJS book
        window._book = this.book = new EPUB(blob, {});

        this.book.renderTo(window.bookView, {
          height: window.innerHeight + 'px',
          width: window.innerWidth + 'px'
        });

        return this.book.ready;
      })
      .then(() => {
        return this.book.rendition.display();
      })
      .then(() => {
        return localforage.getItem(`locations-${this.state.book.id}`);
      })
      .then(locations => {
        return locations == null
          ? this.book.locations.generate(1000)
          : Promise.resolve(locations);
      })
      .then(locations => {
        if (!this.book.locations._locations.length)
          this.book.locations.load(locations);

        // Set initial location to bookmark
        if (this.state.book.bookmarks.length > 0) {
          this.book.rendition.display(this.state.book.bookmarks[0].cfi);
        }
        // Set initial location to percentage
        else {
          this.book.rendition.display(
            this.book.locations.cfiFromPercentage(this.state.book.percent / 100)
          );
        }

        return this._getFilters();
      })
      .then(f => {
        this._applyStyles();
        this._applyFilters(f);

        return new Promise(resolve => {
          const interval = setInterval(() => {
            if (!this.book.rendition.getContents().length) return;

            clearInterval(interval);
            resolve();
          }, 50);
        });
      })
      .then(() => {
        this._addEventListeners();
        this._applyHighlights(this.state.highlight);

        this.setState({ loading: false });

        return updateAnnotations(
          this.state.book.annotations,
          App.state.account.xyAnnotationsKey
        );
      })
      .then(annotations => {
        // Merge object with book in states and storage
        this._updateBook({ annotations });

        // Save locations
        localforage.setItem(
          `locations-${this.state.book.id}`,
          this.book.locations._locations
        );
      })
      .catch(err => !console.error(err) && history.back());
  }

  /**
   * Update book's percent complete and last read time. Clean up.
   */
  componentWillUnmount() {
    document.querySelector('body>main').id = 'content';

    if (!this.book) return;

    this.book.destroy();
    window._book = this.book = undefined;

    const data = {
      percent: this.state.percent,
      last_read: Date.now()
    };

    const { App } = this.props;
    App.store.dispatch(updateBook(this.state.book.id, data));
    App.store.dispatch(save('books'));

    localforage.removeItem(`search-${this.state.book.id}`);

    navigator.onLine &&
      request
        .put(
          `${XYLIBRARY_URL}/libraries/${App.state.account.library}` +
            `/books/${this.state.book.id}/metadata`
        )
        .send({
          xyfir: data
        })
        .end((err, res) => {
          if (err || res.body.error)
            console.error('Reader.componentWillUnmount()', err, res);
        });
  }

  /**
   * @typedef {object} HighlightMode
   * @prop {string} mode
   * @prop {number} [index]
   * @prop {string} [search]
   * @prop {string} [message]
   * @prop {string} [previousMode]
   */
  /**
   * Set or cycle through highlight modes.
   * @param {HighlightMode} [highlight] Allows highlight mode to be set directly
   *  instead of cycling to next mode.
   * @return {HighlightMode}
   */
  onSetHighlightMode(highlight) {
    highlight =
      highlight ||
      (() => {
        switch (this.state.highlight.mode) {
          // none -> notes
          case 'none':
            return { mode: 'notes' };

          // notes -> first annotation set OR none
          case 'notes':
            if (
              !this.state.book.annotations ||
              !this.state.book.annotations.length
            )
              return { mode: 'none' };
            else return { mode: 'annotations', index: 0 };

          // annotations -> next set OR none
          case 'annotations':
            if (this.state.book.annotations[this.state.highlight.index + 1]) {
              return {
                mode: 'annotations',
                index: this.state.highlight.index + 1
              };
            } else {
              return { mode: 'none' };
            }
        }
      })();

    (highlight.message = (() => {
      switch (highlight.mode) {
        case 'none':
          return 'Highlights turned off';
        case 'notes':
          return 'Highlighting notes';
        case 'search':
          return 'Highlighting search matches';
        case 'annotations':
          return (
            'Highlighting annotations from ' +
            this.state.book.annotations[highlight.index].title
          );
      }
    })()),
      (highlight.previousMode = this.state.highlight.mode);

    this._applyHighlights(highlight);
    this.setState({ highlight });

    return highlight;
  }

  /**
   * Open or close a modal.
   * @param {string} show
   */
  onToggleShow(show) {
    if (!!this.state.show) this.setState({ modal: { show: '', target: '' } });
    else this.setState({ modal: { show, target: '' } });

    this._overlay.show = false;
  }

  /**
   * Close the open modal.
   */
  onCloseModal() {
    this.setState({ modal: { target: '', show: '' } });
  }

  /**
   * Handle next / previous page on swipes.
   * @param {string} dir - 'left|right'
   */
  onSwipe(dir) {
    switch (dir) {
      case 'left':
        return this.book.rendition.next();
      case 'right':
        return this.book.rendition.prev();
    }
  }

  /**
   * Called when a user clicks or taps a section of the screen that corresponds
   * to an action.
   * @param {string} action
   */
  onClick(action) {
    if (this.state.modal.show) {
      if (Date.now() > this.state.modal.closeWait) this.onCloseModal();
      return;
    }

    switch (action) {
      case 'previous page':
        return this.book.rendition.prev();
      case 'next page':
        return this.book.rendition.next();
      case 'cycle highlights':
        return this._overlay._status._setStatus(this.onSetHighlightMode());
      case 'show book info':
        return this.onToggleShow('bookInfo');
      case 'toggle navbar':
        return (this._overlay.show = !this._overlay.show);
    }
  }

  /**
   * Listens for clicks on `<a>` elements.
   * @param {MouseEvent} e
   */
  onAnchorClick(e) {
    if (e.target.nodeName != 'A') return;

    // !! e.target.href and getAttribute('href') return different values
    const href = e.target.getAttribute('href');

    // Outbound link
    if (/^https?:\/\//.test(href)) {
      e.preventDefault();
      openWindow(href);
    }
    // Points to location in book
    else {
      const items = this.state.history.items.slice();

      if (items.length == 20) items.shift();

      items.push(this.book.rendition.location.start.cfi);

      this.setState({ history: { items, index: -1 } });
      this._overlay.show = false;
    }
  }

  /**
   * Triggered when highlighted text within the book's content is clicked.
   * @param {MessageEvent} event
   * @param {object} event.data
   * @param {boolean} event.data.xy
   * @param {string} event.data.type - `"note|annotation|search"`
   * @param {string} event.data.key
   */
  onHighlightClicked(event) {
    if (!event.data.xy) return;

    if (event.data.type == 'annotation') {
      clearTimeout(this.timeout);
      this.clickedItems.push(event.data.key);

      this.timeout = setTimeout(() => {
        // Filter out duplicates
        this.clickedItems = Array.from(new Set(this.clickedItems));

        this.setState({
          modal: {
            closeWait: Date.now() + 100,
            target:
              this.clickedItems.length == 1
                ? this.clickedItems[0]
                : this.clickedItems,
            show: 'viewAnnotations'
          }
        });
        this.clickedItems = [];
      }, 10);
    } else {
      this.setState({
        modal: {
          closeWait: Date.now() + 100,
          target: event.data.key,
          show: event.data.type == 'note' ? 'notes' : 'search'
        }
      });
    }
  }

  /**
   * Load the reader styles.
   * @async
   * @return {object}
   */
  async _getStyles() {
    const s1 = this.props.App.state.config.reader;

    try {
      const s2 = await localforage.getItem(`styling-${this.state.book.id}`);
      return s2 ? Object.assign({}, s1, s2) : s1;
    } catch (err) {
      return s1;
    }
  }

  /**
   * Load styles and apply them.
   * @async
   */
  async _applyStyles() {
    const styles = await this._getStyles();

    // Unfortunately, !important is needed to fight the publisher's styling
    this.book.rendition.themes.default({
      '*': {
        color: `${styles.color} !important`,
        'font-family': `${styles.fontFamily} !important`
      },
      p: {
        'text-align': `${styles.textAlign} !important`,
        'text-indent': `${styles.textIndent}em !important`
      },
      'html, body': {
        'background-color': `${styles.backgroundColor} !important`
      },
      'p, span': {
        'font-size': `${styles.fontSize}em !important`,
        'line-height': `${styles.lineHeight}em !important`
      },
      'span.xy-annotation': {
        'background-color': hexToRGBA(styles.annotationColor, 0.5),
        'font-size': 'inherit !important',
        cursor: 'pointer'
      },
      'span.xy-search': {
        'background-color': styles.searchMatchColor,
        'font-size': 'inherit !important',
        cursor: 'pointer'
      },
      'span.xy-note': {
        'background-color': styles.highlightColor,
        'font-size': 'inherit !important',
        cursor: 'pointer'
      }
    });
    this.book.rendition.themes.update('default');
  }

  /**
   * Apply CSS filters to the `div.reader` element.
   * @param {object} filters
   */
  _applyFilters(filters) {
    document.querySelector('div.reader').style.filter =
      `brightness(${filters.brightness}%) ` +
      `contrast(${filters.contrast}%) ` +
      `sepia(${filters.warmth}%)`;
  }

  /**
   * Load the filters applied to the book.
   * @async
   * @return {object}
   */
  async _getFilters() {
    const f1 = {
      brightness: 100,
      warmth: 0,
      contrast: 100
    };

    try {
      const f2 = await localforage.getItem(`filters-${this.state.book.id}`);
      return f2 ? Object.assign({}, f1, f2) : f1;
    } catch (err) {
      return f1;
    }
  }

  /**
   * Add EPUBJS and other event listeners.
   */
  _addEventListeners() {
    // Update pages left in chapter
    // Update percent complete
    this.book.rendition.on('relocated', location => {
      let pagesLeft =
        this.book.rendition.manager.location[0].totalPages -
        this.book.rendition.manager.location[0].pages[0];
      pagesLeft = this.book.rendition.manager.location[0].pages[1]
        ? Math.floor(pagesLeft / 2)
        : pagesLeft;

      this.setState({
        pagesLeft,
        percent: +location.end.percentage.toFixed(2) * 100
      });
    });

    // Apply styles
    // Insert annotations / highlight notes
    // Add swipe and click listeners
    this.book.rendition.on('rendered', (section, view) => {
      this._applyStyles();
      this._applyHighlights(this.state.highlight);

      const [{ document }] = this.book.rendition.getContents();

      swipeListener(document, this.book, this.onSwipe);
      clickListener(document, this.book, this.onClick);

      document.addEventListener('click', this.onAnchorClick);
    });

    window.addEventListener('message', this.onHighlightClicked);

    this.book.rendition.emit('rendered');
  }

  /**
   * Apply highlights to the book's rendered HTML.
   * @param {HighlightMode} highlight
   */
  _applyHighlights(highlight) {
    const { notes, annotations } = this.state.book;
    const [{ document }] = this.book.rendition.getContents();

    // Reset HTML if needed
    switch (highlight.previousMode) {
      case 'notes':
      case 'search':
      case 'annotations':
        document.body.innerHTML = this.oghtml;
    }

    this.oghtml = document.body.innerHTML;

    // Apply appropriate highlights
    if (highlight.mode == 'notes') {
      highlightNotes(this.book, notes);
    } else if (highlight.mode == 'search') {
      highlightSearch(this.book, highlight.search);
    } else if (
      highlight.mode == 'annotations' &&
      annotations &&
      annotations[highlight.index]
    ) {
      AnnotateEPUBJS.insertAnnotations(this.book, annotations[highlight.index]);
    }
  }

  /**
   * Updates the book object in component state, application state, and local
   * storage.
   * @param {object} obj
   */
  _updateBook(obj) {
    this.props.App.store.dispatch(updateBook(this.state.book.id, obj));
    this.setState({ book: Object.assign({}, this.state.book, obj) });
    this.props.App.store.dispatch(save('books'));
  }

  render() {
    return (
      <div className="reader">
        <div id="bookView" />

        <Overlay ref={i => (this._overlay = i)} Reader={this} />

        <Modal Reader={this} />
      </div>
    );
  }
}
