require('dotenv').config()
const axios = require('axios');


const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt')
const cors = require('cors');

const multer = require('multer');
const upload = multer({ dest: "uploads/" });

var express = require('express');

var app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(express.static('public'));


const PORT = process.env.PORT || 3001;

app.listen(PORT, function () {
    console.log('Server running on port ' + PORT);
});

const conf = {
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    dateStrings: false,
    timezone: '+00:00'
}


/**
 * Gets the products
 * Optional product id query parameter for filtering only certain product id
 * Optional product name query parameter for filtering only certain product name
 * Optional category query parameter for filtering only products from that category
 */
app.get('/products', async (req, res) => {
    try {
        const connection = await mysql.createConnection(conf);

        const id = req.query.id;
        
        const productname = req.query.productname;

        const category = req.query.category;

        let result;        
        if(id){
            result = await connection.execute("SELECT id, product_name productName, price, image_url imageUrl, category  FROM product WHERE id=?", [id]);
        }else if(productname){
            result = await connection.execute("SELECT id, product_name productName, price, image_url imageUrl, category  FROM product WHERE product_name=?", [productname]);
        }else if(category){
            result = await connection.execute("SELECT id, product_name productName, price, image_url imageUrl, category  FROM product WHERE category=?", [category]);
        }else{
            result = await connection.execute("SELECT id, product_name productName, price, image_url imageUrl, category  FROM product");
        }
        
        //First index in the result contains the rows in an array
        res.json(result[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


/**
 * Gets all the categories
 * Optional category query parameter for filtering only certain product category by name
 */
app.get('/categories', async (req, res) => {

    try {
        const connection = await mysql.createConnection(conf);

        const categoryname = req.query.categoryname;

        const [rows] = await connection.execute("SELECT category_name categoryName, category_description description FROM product_category WHERE category_name=?", [categoryname]);

        res.json(rows);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/customer', async(req,res) => {

    //Get the bearer token from authorization header
    const token = req.headers.authorization.split(' ')[1];

    //Verify the token. Verified token contains username
    try{
        const username = jwt.verify(token, process.env.JWT_KEY).username;
        const connection = await mysql.createConnection(conf);
        const [rows] = await connection.execute('SELECT first_name fname, last_name lname, username FROM customer WHERE username=?',[username]);
        res.status(200).json(rows[0]);
    }catch(err){
        console.log(err.message);
        res.status(403).send('Access forbidden.');
    }
});

/**
 * Adds new product categories
 */
app.post('/categories', async (req, res) => {

    const connection = await mysql.createConnection(conf);

    try {
        
        connection.beginTransaction();
        const categories = req.body;
        
        for (const category of categories) {
            await connection.execute("INSERT INTO product_category VALUES (?,?)",[category.categoryName, category.description]);
        }
    
        connection.commit();
        res.status(200).send("Categories added!");

    } catch (err) {
        connection.rollback();
        res.status(500).json({ error: err.message });
    }
});


/**
 * Adds new products */
app.post('/products', async (req, res) => {

    const connection = await mysql.createConnection(conf);

    try {
        
        connection.beginTransaction();
        const products = req.body;
        

        for (const product of products) {
            await connection.execute("INSERT INTO product (product_name, price, image_url,category) VALUES (?,?,?,?)",[product.productName, product.price, product.imageUrl, product.category]);
        }
    
        connection.commit();
        res.status(200).send("Products added!");

    } catch (err) {
        connection.rollback();
        res.status(500).json({ error: err.message });
    }
});
/**
 * Update product price of the given product. Product id and price needs to be given.
 */
app.post('/products/priceupdate', async (req, res) => {

    const connection = await mysql.createConnection(conf);

    try {
        connection.beginTransaction();

        const {id, price} = req.body;

        // Check that both id and price are given
        if (!id || !price) {
            await connection.rollback();
            return res.status(400).json({ error: 'Price and id are both required for request' });
        }

        await connection.execute('UPDATE product SET price=? WHERE id=?', [price, id]);
        
        // Commit the transaction
        await connection.commit();
        console.log('tietokanta päivitetty');

        res.status(200).json({message: 'Price updated succesfully for product id ' + id});

    } catch (err) {
        console.error(err);
        
        // Roll back the transaction in case of an error
        await connection.rollback();

        res.status(500).json({ error: err.message });
    }
});

/**
 * Place an order. 
 */
app.post('/order', async (req, res) => {

    let connection;

    try {
        connection = await mysql.createConnection(conf);
        connection.beginTransaction();

        const order = req.body;
        
        const [info] = await connection.execute("INSERT INTO customer_order (order_date, customer_id) VALUES (NOW(),?)",[order.customerId]);
        
        const orderId = info.insertId;

        for (const product of order.products) {
            await connection.execute("INSERT INTO order_line (order_id, product_id, quantity) VALUES (?,?,?)",[orderId, product.id, product.quantity]);            
        }

        connection.commit();
        res.status(200).json({orderId: orderId});

    } catch (err) {
        connection.rollback();
        res.status(500).json({ error: err.message });
    }
});


//(Authentication/JWT could be done with middleware also)


/**
 * Registers user. Supports urlencoded and multipart
 */
app.post('/register', upload.none(), async (req,res) => {
    const fname = req.body.fname;
    const lname = req.body.lname;
    const uname = req.body.username;
    const pw = req.body.pw;

    try {
        const connection = await mysql.createConnection(conf);

        const pwHash = await bcrypt.hash(pw, 10);

        const [rows] = await connection.execute('INSERT INTO customer(first_name,last_name,username,pw) VALUES (?,?,?,?)',[fname,lname,uname,pwHash]);

        res.status(200).end();

    } catch (err) {
        res.status(500).json({ error: err.message });
    }

});

/**
 * Checks the username and password and returns jwt authentication token if authorized. 
 * Supports urlencoded or multipart
 */
app.post('/login', upload.none(), async (req, res) => {
    const uname = req.body.username;
    const pw = req.body.pw;


    try {
        const connection = await mysql.createConnection(conf);

        const [rows] = await connection.execute('SELECT pw FROM customer WHERE username=?', [uname]);

        if(rows.length > 0){
            const isAuth = await bcrypt.compare(pw, rows[0].pw);
            if(isAuth){
                const token = jwt.sign({username: uname}, process.env.JWT_KEY);
                res.status(200).json({jwtToken: token});
            }else{
                res.status(401).end('User not authorized');
            }
        }else{
            res.status(404).send('User not found');
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


/**
 * Gets orders of the customer
 */
app.get('/orders', async (req,res) => {
    
    //Get the bearer token from authorization header
    const token = req.headers.authorization.split(' ')[1];

    //Verify the token. Verified token contains username
    try{
        const username = jwt.verify(token, process.env.JWT_KEY).username;
        const orders = await getOrders(username);
        res.status(200).json(orders);
    }catch(err){
        console.log(err.message);
        res.status(403).send('Access forbidden.');
    }
});

async function getOrders(username){
    try {
        const connection = await mysql.createConnection(conf);
        const [rows] = await connection.execute('SELECT customer_order.order_date AS date, customer_order.id as orderId FROM customer_order INNER JOIN customer ON customer.id = customer_order.customer_id WHERE customer.username=?', [username]);

        let result = [];

        for (const row of rows) {
            const [products] = await connection.execute("SELECT id,product_name productName,price,image_url imageUrl, category, quantity  FROM product INNER JOIN order_line ON order_line.product_id = product.id WHERE order_line.order_id=?", [row.orderId]);

            let order ={
                orderDate: row.date,
                orderId: row.orderId,
                products: products
            }

            result.push(order);
        }


        return result;
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: err.message });
    }
}

// GET stockbalance gives the value of stock in response. The query can be done for whole stock or for one product id.This gives as response
// the id, tuotenimi, määrä, If the query is done for total, 
// the query is: http://localhost:3001/stockbalance?total=true
app.get('/stockbalance', async (req, res) => {
    try {
        const connection = await mysql.createConnection(conf);

        const id = req.query.id;
        const total = req.query.total;

        if (total && total.toLowerCase() === 'true') {
            const grandTotalResult = await connection.execute("SELECT SUM(amount * price) as grand_total FROM product");

            res.json(grandTotalResult[0][0]); // Respond with the grand total value of all items in the stock
            return;
        }

        let result;        
        if(id){
            result = await connection.execute("SELECT id, product_name productName, amount, price, amount * price as stock_balance FROM product WHERE id=?", [id]);
        }else{
            result = await connection.execute("SELECT id, product_name productName, amount, price, amount * price as stock_balance FROM product");
        }
        
        //First index in the result contains the rows in an array
        res.json(result[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all the products that have not enough items in stock for fulfilling the orders that are in for them. The response is giving the product,
//product name, price, amount in stock and total amount of orders
app.get('/lowstockproducts', async (req, res) => {
    try {
        const connection = await mysql.createConnection(conf);

        const result = await connection.execute(`
            SELECT p.id, p.product_name, p.price, p.amount, COALESCE(SUM(ol.quantity), 0) as total_ordered 
            FROM product p
            LEFT JOIN order_line ol ON p.id = ol.product_id
            LEFT JOIN customer_order co ON ol.order_id = co.id
            GROUP BY p.id, p.product_name, p.price, p.amount
            HAVING p.amount - total_ordered < 0
        `);

        // First index in the result contains the rows in an array
        res.json(result[0]);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
