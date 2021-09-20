'use strict';
import { Sequelize, Model, DataTypes, Optional } from 'sequelize';

interface UserAttributes {
  id: number
  username: string
  email: string | null
  salt: Buffer | null
  hash: Buffer | null
  discordId: string | null
}

type UserCreationAttributes = Optional<UserAttributes, "id">;

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  id: number
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  username: string
  email: string | null
  salt: Buffer | null
  hash: Buffer | null
  discordId: string | null
}

const createModel = (sequelize: Sequelize) => {
  User.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: [1, 255],
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore because I think the type annotation is wrong.
          args: [
            {
              require_tld: process.env.NODE_ENV === 'production',
            },
          ],
        },
      },
    },
    salt: {
      type: DataTypes.BLOB,
      allowNull: true,
      validate: {
        len: [1, 256],
      },
    },
    hash: {
      type: DataTypes.BLOB,
      allowNull: true,
    },
    discordId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: "User",
    validate: {
      ensureCredentials(this: User) {
        if (this.email !== this.getDataValue("email")) {
          let descriptor = Object.getOwnPropertyDescriptor(this, "email");
          throw new Error(`Encountered weird bug! email attribute does not match the internal dataValue!
          getOwnPropertyDescriptor for email = ${JSON.stringify(descriptor)}
          get function: ${typeof descriptor.get} ${descriptor.get?.toString()}
          set function: ${typeof descriptor.set}
          `);
        }
        if ((!this.email || !this.hash || !this.salt) && !this.discordId) {
          throw new Error('Incomplete login credentials. Requires social login or email/password.');
        }
      },
    },
  });
  // // eslint-disable-next-line no-unused-vars
  // User.associate = function(models) {
  //   // User.hasMany(models.Room, { as: "rooms" });
  // };
  return User;
};

export default createModel;
module.exports = createModel;
