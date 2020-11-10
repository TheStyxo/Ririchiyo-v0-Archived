const { Collection } = require('discord.js');
const { Permissions } = require('discord.js');
const InternalPermissions = require('./InternalPermissions');
const defaultPermissionData = require('../../schemas/PermissionData');
const { deepMerge } = require('../util/functions');

module.exports = class RolePermissions {
    constructor(db, RolePermissionsData, guildID) {
        this._cache = new Collection();
        this.getForAllRoles = function () {
            const rolePermissions = new Collection();
            for (const roleID in RolePermissionsData) rolePermissions.set(roleID, this.getForRole(roleID));
            return rolePermissions;
        };
        this.getForRole = function (roleID) {
            const cacheCheck = this._cache.get(roleID);
            if (cacheCheck) return cacheCheck;
            const merged = deepMerge(defaultPermissionData, RolePermissionsData[roleID]);
            const rolePermissionInst = new RolePermission(db, merged, guildID, roleID);
            this._cache.set(roleID, rolePermissionInst);
            return rolePermissionInst;
        };
    }
}

class RolePermission {
    constructor(db, rolePermissionData, guildID, roleID) {
        this.discord = {
            allowed: new Permissions(rolePermissionData.discord.allowed),
            denied: new Permissions(rolePermissionData.discord.denied),
            allow: async function (permsArray) {
                this.allowed.add(permsArray);
                this.denied.remove(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.roles.${roleID}.discord.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.roles.${roleID}.discord.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
            deny: async function (permsArray) {
                this.allowed.remove(permsArray);
                this.denied.add(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.roles.${roleID}.discord.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.roles.${roleID}.discord.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
            reset: async function (permsArray) {
                this.allowed.remove(permsArray);
                this.denied.remove(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.roles.${roleID}.discord.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.roles.${roleID}.discord.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
        }
        this.internal = {
            allowed: new InternalPermissions(rolePermissionData.discord.allowed),
            denied: new InternalPermissions(rolePermissionData.discord.denied),
            allow: async function (permsArray) {
                this.allowed.add(permsArray);
                this.denied.remove(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.roles.${roleID}.internal.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.roles.${roleID}.internal.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
            deny: async function (permsArray) {
                this.allowed.remove(permsArray);
                this.denied.add(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.roles.${roleID}.internal.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.roles.${roleID}.internal.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
            reset: async function (permsArray) {
                this.allowed.remove(permsArray);
                this.denied.remove(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.roles.${roleID}.internal.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.roles.${roleID}.internal.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
        }
        this.calculateOverwrites = function (discordRolePermissions) {
            const resolvedDiscordRolePermissions = new Permissions(discordRolePermissions);
            this.discord.actualPermissions = new Permissions(resolvedDiscordRolePermissions).freeze();
            if (!resolvedDiscordRolePermissions.has("ADMINISTRATOR")) {
                const discordUserPermissionsCalculated = new Permissions(resolvedDiscordRolePermissions);
                const internalUserPermissionsCalculated = new InternalPermissions(InternalPermissions.DEFAULT)
                discordUserPermissionsCalculated.add(this.discord.allowed);
                discordUserPermissionsCalculated.remove(this.discord.denied);
                internalUserPermissionsCalculated.add(this.internal.allowed);
                internalUserPermissionsCalculated.remove(this.internal.denied);
                this.discord.final = discordUserPermissionsCalculated;
                this.internal.final = internalUserPermissionsCalculated;
            }
            else {
                this.discord.final = new Permissions(Permissions.ALL);
                this.internal.final = new InternalPermissions(InternalPermissions.ADMINISTRATOR)
            }
            return this;
        }
    }
}