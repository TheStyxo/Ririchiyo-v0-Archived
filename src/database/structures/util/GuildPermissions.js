const RolePermissions = require('./RolePermissions');
const UserPermissions = require('./UserPermissions');


module.exports = class GuildPermissions {
    constructor(db, permissionsData, id) {
        this.roles = new RolePermissions(db, permissionsData.roles, id);
        this.users = new UserPermissions(db, permissionsData.users, id, this.roles);
    }
}