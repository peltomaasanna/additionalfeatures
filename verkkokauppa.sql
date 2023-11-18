DROP TABLE IF EXISTS order_line;
DROP TABLE IF EXISTS customer_order;
DROP TABLE IF EXISTS customer;
DROP TABLE IF EXISTS product;
DROP TABLE IF EXISTS product_category;

CREATE TABLE product_category(
    category_name VARCHAR(255) NOT NULL PRIMARY KEY,
    category_description VARCHAR(500)
);

CREATE TABLE product(
    id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2),
    image_url VARCHAR(255),
    category VARCHAR(255),
    FOREIGN KEY (category) REFERENCES product_category(category_name)
);

CREATE TABLE customer(
    id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    username VARCHAR(255) UNIQUE,
    pw VARCHAR(255)
);

CREATE TABLE customer_order(
    id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    order_date DATETIME NOT NULL,
    customer_id INT,
    FOREIGN KEY (customer_id) REFERENCES customer(id)
);

CREATE TABLE order_line(
    order_id INT,
    product_id INT,
    quantity INT,
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (order_id) REFERENCES customer_order(id),
    FOREIGN KEY (product_id) REFERENCES product(id)
);


INSERT INTO product_category VALUES ('Computers', 'Laptop and desktop computers'),
('Sports', 'Sport equipment'),('Bikes', 'City and MTB bikes'),('Music', 'Guitars, drums and other instruments'), ('Phones', 'Mobile devices for all uses');


INSERT INTO product (product_name, price, category) VALUES ('Macbook Pro 13', 1200, 'Computers'),('iPhone 13', 700, 'Phones'), ('Umbro football', 25, 'Sports'),
('Fender Stratocaster', 1550, 'Music'), ('Gipson Les Paul', 2100, 'Music'), ('Google Pixel', 780, 'Phones');
