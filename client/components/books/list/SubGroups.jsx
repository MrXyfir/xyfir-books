import React from "react";

// Components
import Search from "../../misc/Search";

// Modules
import findListItems from "../../../lib/books/find-list-items";

export default class SubGroups extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        let subgroups = {/* 'subgroup': booksCount */};
        
        this.props.data.books.forEach(book => {
            if (this.props.group == "ratings") {
                const rating = book.rating === undefined
                    ? "Unrated" : book.rating === 0
                        ? "No Stars" : Math.floor(book.rating) + " Stars"; 
                
                if (subgroups[rating] === undefined)
                    subgroups[rating] = 1;
                else
                    subgroups[rating]++;
            }
            else if (this.props.group == "tags") {
                book.tags.forEach(tag => {
                    if (subgroups[tag] === undefined)
                        subgroups[tag] = 1;
                    else
                        subgroups[tag]++;
                });
            }
            else {
                if (book[this.props.group] === undefined)
                    return;
                if (subgroups[book[this.props.group]] === undefined)
                    subgroups[book[this.props.group]] = 1;
                else
                    subgroups[book[this.props.group]]++;
            }
        });
        
        return (
            <div className={`list-${this.props.group.replace('_', '-')}`}>
                <Search dispatch={this.props.dispatch} />
                <table className="list">{
                    findListItems(subgroups, this.props.data.search).map(subgroup => {
                        return (
                            <tr>
                                <td><a href={
                                    `#books/list/all?${this.props.queryKey || this.props.group}`
                                    + `=${encodeURIComponent(subgroup)}`
                                }>{subgroup}</a></td>
                                <td>{subgroups[subgroup]}</td>
                            </tr>
                        )
                    }).sort()
                }</table>
            </div>
        );
    }

}