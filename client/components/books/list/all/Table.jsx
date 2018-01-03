import request from 'superagent';
import React from 'react';

// Modules
import deleteBooks from 'lib/books/delete';
import findMatches from 'lib/books/find-matching';
import loadCovers from 'lib/books/load-covers';
import sortBooks from 'lib/books/sort';
import toUrl from 'lib/url/clean';
import rand from 'lib/random/number';

// Constants
import { XYLIBRARY_URL } from 'constants/config';

export default class TableList extends React.Component {

  constructor(props) {
    super(props);

    const selected = this.props.data.books.length
      ? [rand(0, this.props.data.books.length - 1)]
      : [];

    this.state = {
      selected, sort: this.props.data.config.bookList.table.defaultSort
    };
  }

  componentDidMount() {
    loadCovers(this.props.data.books, this.props.data.account.library);
  }

  componentDidUpdate() {
    loadCovers(this.props.data.books, this.props.data.account.library);
  }

  onSelect(e, id) {
    // Select multiple items
    if (e.ctrlKey) {
      // Add item
      if (this.state.selected.indexOf(id) == -1)
        this.setState({ selected: this.state.selected.concat([id]) });
      // Remove item
      else if (this.state.selected.length > 1)
        this.setState({ selected: this.state.selected.filter(s => s != id) });
    }
    // Select single item
    else {
      this.setState({ selected: [id] });
    }
  }

  onDelete() {
    const selected = this.state.selected.slice();
    this.setState({ selected: [] });

    deleteBooks(selected, this.props.dispatch);
  }

  onSort(column) {
    // Flip state.sort.asc, retain column
    if (this.state.sort.column == column)
      this.setState({ sort: { column, asc: !this.state.sort.asc } });
    // Change state.sort.column, asc always true
    else
      this.setState({ sort: { column, asc: true } });
  }

  render() {
    const selectedBook = this.props.data.books.find(b =>
      b.id == this.state.selected[this.state.selected.length - 1]
    );
    if (selectedBook) {
      selectedBook.url = selectedBook.id
        + '/' + toUrl(selectedBook.authors)
        + '/' + toUrl(selectedBook.title);

      if (selectedBook.identifiers === undefined)
        selectedBook.identifiers = {};
    }

    return (
      <div className='list-table'>
        <div className='table-container'>
        <table className='books'>
          <thead>
          <tr>{
            this.props.data.config.bookList.table.columns.map(col =>
              <th
                className={this.state.sort.column == col ? 'sort-by' : ''}
                onClick={() => this.onSort(col)}
              >{
                col.replace(/\b[a-z]/g, c => c.toUpperCase())
              }</th>
            )
          }</tr>
          </thead>

          <tbody>{
            sortBooks(
              findMatches(
                this.props.data.books, this.props.data.search.query
              ), this.state.sort.column, this.state.sort.asc
            ).map(book =>
              <tr
                className={`book ${
                  this.state.selected.indexOf(book.id) > -1
                  ? 'selected' : ''
                }`}
                onClick={(e) => this.onSelect(e, book.id)}
              >{
                this.props.data.config.bookList.table.columns
                .map(col => {
                  switch (col) {
                    case 'added': return (
                      <td className='added'>{
                        (new Date(book.timestamp))
                          .toLocaleDateString()
                      }</td>
                    );

                    case 'rating': return (
                      <td className='rating'>{
                        book.rating === undefined
                        ? 'None' : (
                          <span>
                            {book.rating}
                            <span className='icon-star' />
                          </span>
                        )
                      }</td>
                    );

                    case 'published': return (
                      <td className='published'>{
                        (new Date(book.pubdate))
                          .toLocaleDateString()
                      }</td>
                    );

                    case 'series': return (
                      <td className='series'>{
                        !book.series
                          ? ''
                          : `${book.series} [${book.series_index}]`
                      }</td>
                    );

                    default: return (
                      <td className={col}>{
                        book[col]
                      }</td>
                    );
                  }
                })
              }</tr>
            )
          }</tbody>
        </table>
        </div>

        <div className='selected-book'>
          {this.state.selected.length > 0 ? (
            <div className='controls'>
              {this.state.selected.length > 1 ? null : (
                <a href={`#/books/read/${selectedBook.url}`}>
                  <span className='icon-eye' />Read
                </a>
              )}

              <a onClick={() => this.onDelete()}>
                <span className='icon-trash' />Delete
              </a>

              {this.state.selected.length > 1 ? (
                <a href={`#/books/bulk-edit/${
                  this.state.selected.join(',')
                }`}>
                  <span className='icon-edit' />Bulk Edit
                </a>
              ) : (
                <a href={`#/books/manage/${selectedBook.url}`}>
                  <span className='icon-edit' />Manage
                </a>
              )}

              {this.state.selected.length > 1 ? (<span />) : (
                <a href={`#/books/add-format/${selectedBook.url}`}>
                  <span className='icon-files' /> Add Format
                </a>
              )}
            </div>
          ) : null}

          {this.state.selected.length ? (
            <div className='info'>
              <a href={`#/books/read/${selectedBook.url}`}>
                <img
                  className='cover'
                  id={`cover-${selectedBook.id}`}
                />
              </a>

              <span className='chip percent-complete'>{
                selectedBook.percent_complete + '%'
              }</span>

              {selectedBook.word_count > 0 ? (
                <span className='chip word-count'>{
                  Math.round(selectedBook.word_count / 1000) + 'K'
                }</span>
              ) : null}

              <span className='chip date-added'>{
                (new Date(selectedBook.timestamp))
                  .toLocaleDateString()
              }</span>

              {!!+selectedBook.rating ? (
                <span className='chip rating'>
                  <span>{selectedBook.rating}</span>
                  <span className='icon-star' />
                </span>
              ) : null}

              <dl>
                <dt>Title</dt><dd>{selectedBook.title}</dd>

                <dt>Authors</dt><dd><a href={
                  `#/books/list/all?search=1&authors=${
                    encodeURIComponent(selectedBook.authors)
                  }`
                }>{selectedBook.authors}</a></dd>

                {selectedBook.series ? (
                  <div>
                    <dt>Series</dt>
                    <dd>#{selectedBook.series_index} of <a href={
                      `#/books/list/all?search=1&series=${
                        encodeURIComponent(selectedBook.series)
                      }`
                    }>{selectedBook.series}</a></dd>
                  </div>
                ) : null}

                <dt>Published</dt>
                <dd>{
                  (new Date(selectedBook.pubdate))
                    .toLocaleDateString()
                } by <a href={
                  '#/books/list/all?search=1&publisher='
                  + encodeURIComponent(selectedBook.publisher)
                }>{
                  selectedBook.publisher
                }</a></dd>

                <dt>Formats</dt>
                <dd className='formats'>{
                  selectedBook.formats.map(format =>
                    <a
                      target='_blank'
                      href={
                        `${XYLIBRARY_URL}/files/` +
                        `${this.props.data.account.library}/${format}`
                      }
                    >{
                      format.split('.').slice(-1)[0].toUpperCase()
                    }</a>
                  )
                }</dd>

                <dt>Links</dt>
                <dd className='links'>{
                  Object
                    .keys(selectedBook.identifiers)
                    .map(type => {
                      const id = [type, selectedBook.identifiers[type]];

                      switch (id[0]) {
                        case 'isbn': return (
                          <a
                            target='_blank'
                            href={
                              `http://www.abebooks.com/book-search/isbn/${id[1]}`
                            }
                          >ISBN ({id[1]})</a>
                        );

                        case 'goodreads': return (
                          <a
                            target='_blank'
                            href={`http://www.goodreads.com/book/show/${id[1]}`}
                          >GoodReads</a>
                        );

                        case 'mobi-asin':
                        case 'amazon': return (
                          <a
                            target='_blank'
                            href={`http://www.amazon.com/dp/${id[1]}`}
                          >Amazon</a>
                        );

                        case 'google': return (
                          <a
                            target='_blank'
                            href={
                              `https://books.google.com/books/about/?id=${id[1]}`
                            }
                          >Google Books</a>
                        );

                        case 'barnesnoble': return (
                          <a
                            target='_blank'
                            href={`http://www.barnesandnoble.com/${id[1]}`
                          }>Barnes & Noble</a>
                        );

                        default: return <span />;
                      }
                    })
                }</dd>

                <dt>Tags</dt>
                <dd className='tags'>{
                  selectedBook.tags.map(tag =>
                    <a href={`#/books/list/all?search=1&tag=${
                      encodeURIComponent(tag)}`
                    }>{tag}</a>
                  )
                }</dd>
              </dl>

              <div
                className='comments'
                dangerouslySetInnerHTML={{
                  __html: selectedBook.comments
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

}