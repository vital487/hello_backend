const data = {
    host: '94.62.78.170',
    user: 'nodejs',
    password: 'nodejs',
    database: 'webchat2'
}

exports.initDbConnection = () => {
    const mysql = require('mysql');
    const db = mysql.createConnection(data);

    db.connect((err) => {
        if (err) throw err;
    });

    return db;
}

/*
DATABASE STRUCTURE

CREATE TABLE `users` (
  `id` int(11) PRIMARY KEY AUTO_INCREMENT,
  `firstname` varchar(30) NOT NULL,
  `surname` varchar(30) NOT NULL,
  `email` varchar(255) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `gender` bit(1) NOT NULL,
  `birth` bigint NOT NULL,
  `city` varchar(255) DEFAULT '',
  `country` varchar(255) DEFAULT '',
  `photo` varchar(255) NOT NULL,
  `salt` int NOT NULL,
  `last_update` bigint(20) DEFAULT 0
);

CREATE TABLE `contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `from_id` int(11) NOT NULL,
  `to_id` int(11) NOT NULL,
  `accepted` bit(1) DEFAULT 0,
  `from_alias` varchar(60) DEFAULT NULL,
  `from_color` varchar(10) DEFAULT '#987654',
  `to_alias` varchar(60) DEFAULT NULL,
  `to_color` varchar(10) DEFAULT '#123456',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`from_id`) REFERENCES `users` (`id`),
  FOREIGN KEY (`to_id`) REFERENCES `users` (`id`)
);

CREATE TABLE `groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(60) NOT NULL,
  `photo` varchar(255) NOT NULL,
  `admin_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
);

CREATE TABLE `group_members` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

CREATE TABLE `group_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message` varchar(1000) NOT NULL,
  `from_id` int(11) NOT NULL,
  `to_id` int(11) NOT NULL,
  `date` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`from_id`) REFERENCES `users` (`id`),
  FOREIGN KEY (`to_id`) REFERENCES `groups` (`id`)
);

CREATE TABLE `messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message` varchar(1000) NOT NULL,
  `state` varchar(8) NOT NULL,
  `from_id` int(11) NOT NULL,
  `to_id` int(11) NOT NULL,
  `date` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`to_id`) REFERENCES `users` (`id`),
  FOREIGN KEY (`from_id`) REFERENCES `users` (`id`)
);
*/