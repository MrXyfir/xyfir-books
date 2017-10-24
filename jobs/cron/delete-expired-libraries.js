const request = require('superagent');
const db = require('lib/db');

const config = require('config');

/*
  Delete libraries over a week expired
*/
module.exports = function(fn) {

  db(cn => {
    let sql = `
      SELECT
        user_id, library_id
      FROM users
      WHERE 
        library_id NOT ''
        AND UNIX_TIMESTAMP() > subscription + (7 * 86400000)
    `;
    
    cn.query(sql, (err, rows) => {
      if (err) {
        cn.release();
        fn(true);
      }
      else if (!rows.length) {
        cn.release();
        fn(false);
      }
      else {
        // User ids of users whose libraries were deleted
        let users = [];

        // Update library_id for users whose libraries were deleted
        const updateUsers = () => {
          sql = `
            UPDATE users SET library_id = '', library_size_limit = 1
            WHERE user_id IN(?)
          `;

          cn.query(sql, [users], (err, result) => fn(false));
        }
        
        // Delete libraries from library storage
        const deleteLibrary = (index) => {
          // All libraries finished
          if (rows[index] === undefined) {
            updateUsers();
          }
          // Attempt to delete library at rows[index]
          else {
            request
              .delete(
                config.addresses.library + 'libraries/' +
                rows[index].library_id
              )
              .end((err, res) => {
                // Library deleted
                if (!err && !res.body.error) {
                  users.push(rows[index].user_id);
                }

                deleteLibrary(index + 1);
              });
          }
        };

        deleteLibrary(0);
      }
    });
  });

};