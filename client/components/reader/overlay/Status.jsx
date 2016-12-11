import React from "react";

export default class ReaderStatus extends React.Component {

    constructor(props) {
        super(props);

        this.state = { status: "" };
    }

    _setStatus(hl) {
        clearTimeout(this.timeout);

        let status = "";

        switch (hl.mode) {
            case "none":
                status = "Highlights turned off"; break;
            
            case "notes":
                status = "Now highlighting notes"; break;

            case "annotations":
                status = "Now highlighting annotations from set "
                    + this.props.book.annotations[hl.index].set_title;
                break;
        }

        // Notify user of new highlight mode for 5 seconds
        this.setState({ status });
        this.timeout = setTimeout(() => this.setState({ status: "" }), 5000);
    }

    render() {
        return (
            <span className="status">{
                this.state.status ? (
                    this.state.status
                ) : this.props.loading ? (
                    "Loading..."
                ) : (
                    this.props.percent + "% | " + (
                        !this.props.pagesLeft
                        ? "Last page in chapter"
                        : this.props.pagesLeft + " pages left in chapter"
                    )
                ) 
            }</span>
        );
    }

}