const { Collection } = require('discord.js');
const { Permissions } = require('discord.js');
const InternalPermissions = require('./InternalPermissions');
const defaultPermissionData = require('../../schemas/PermissionData');
const { deepMerge } = require('../util/functions');
const owners = require('../../../../config/owners');

module.exports = class UserPermissions {
    constructor(db, UserPermissionsData, guildID, rolePermissionsClass) {
        this._cache = new Collection();
        this.getForAllUsers = function () {
            const userPermissions = new Collection();
            for (const userID in UserPermissionsData) userPermissions.set(userID, this.getForUser(userID));
            return userPermissions;
        };
        this.getForUser = function (userID) {
            const cacheCheck = this._cache.get(userID);
            if (cacheCheck) return cacheCheck;
            const merged = deepMerge(defaultPermissionData, UserPermissionsData[userID]);
            const userPermissionInst = new UserPermission(db, merged, guildID, userID, rolePermissionsClass);
            this._cache.set(userID, userPermissionInst);
            return userPermissionInst;
        };
    }
}

class UserPermission {
    constructor(db, userPermissionData, guildID, userID, rolePermissionsClass) {
        this.discord = {
            allowed: new Permissions(userPermissionData.discord.allowed),
            denied: new Permissions(userPermissionData.discord.denied),
            allow: async function (permsArray) {
                this.allowed.add(permsArray);
                this.denied.remove(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.users.${userID}.discord.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.users.${userID}.discord.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
            deny: async function (permsArray) {
                this.allowed.remove(permsArray);
                this.denied.add(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.users.${userID}.discord.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.users.${userID}.discord.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
            reset: async function (permsArray) {
                this.allowed.remove(permsArray);
                this.denied.remove(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.users.${userID}.discord.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.users.${userID}.discord.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            }
        }
        this.internal = {
            allowed: new InternalPermissions(userPermissionData.discord.allowed),
            denied: new InternalPermissions(userPermissionData.discord.denied),
            allow: async function (permsArray) {
                this.allowed.add(permsArray);
                this.denied.remove(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.users.${userID}.internal.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.users.${userID}.internal.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
            deny: async function (permsArray) {
                this.allowed.remove(permsArray);
                this.denied.add(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.users.${userID}.internal.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.users.${userID}.internal.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
            reset: async function (permsArray) {
                this.allowed.remove(permsArray);
                this.denied.remove(permsArray);
                await db.updateOne({ _id: guildID }, {
                    $set: {
                        [`settings.permissions.users.${userID}.internal.allowed`]: this.allowed.bitfield,
                        [`settings.permissions.users.${userID}.internal.denied`]: this.denied.bitfield
                    }
                }, { upsert: true })
            },
        }
        this.calculateOverwrites = function (roleIDsArray, discordUserPermissions, isPremium = false) {
            const resolvedDiscordUserPermissions = new Permissions(discordUserPermissions);
            this.discord.actualPermissions = new Permissions(resolvedDiscordUserPermissions).freeze();
            if (owners.find(owner => owner.id == userID)) {
                this.discord.final = new Permissions(Permissions.ALL);
                this.internal.final = new InternalPermissions(InternalPermissions.BOT_OWNER)
            }
            else if (!resolvedDiscordUserPermissions.has("ADMINISTRATOR")) {
                const reversedRoleIDsArray = roleIDsArray.reverse();
                const discordUserPermissionsCalculated = new Permissions(resolvedDiscordUserPermissions);
                const internalUserPermissionsCalculated = new InternalPermissions(InternalPermissions.DEFAULT)
                for (const roleID of reversedRoleIDsArray) {
                    const rolePermsOBJ = rolePermissionsClass.getForRole(roleID);
                    discordUserPermissionsCalculated.add(rolePermsOBJ.discord.allowed);
                    discordUserPermissionsCalculated.remove(rolePermsOBJ.discord.denied);
                    internalUserPermissionsCalculated.add(rolePermsOBJ.internal.allowed);
                    internalUserPermissionsCalculated.remove(rolePermsOBJ.internal.denied);
                }
                discordUserPermissionsCalculated.add(this.discord.allowed);
                discordUserPermissionsCalculated.remove(this.discord.denied);
                internalUserPermissionsCalculated.add(this.internal.allowed);
                internalUserPermissionsCalculated.remove(this.internal.denied);
                console.log(this.internal.denied);
                this.discord.final = discordUserPermissionsCalculated;
                this.internal.final = internalUserPermissionsCalculated;
            }
            else {
                this.discord.final = new Permissions(Permissions.ALL);
                this.internal.final = new InternalPermissions(InternalPermissions.ADMINISTRATOR)
            }
            if (isPremium) this.internal.final.add("PREMIUM_USER");
            return this;
        }
    }
}