require('dotenv').config()
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: [
    // 'http://localhost:5173',
  'https://car-doctor-af2bc.web.app',
  'https://car-doctor-af2bc.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.BD_USER}:${process.env.BD_PASS}@cluster0.kckbgvo.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middleware
const logger = async(req, res, next) => {
  // console.log('colled:', req.host, req.originalUrl);
  console.log('log: info', req.method, req.url);
  next();
}

const verifyToken = async (req, res, next) =>{
  const token = req?.cookies?.token;
  // console.log('token in the middleware', token)
  // no token available
  if (!token) {
    return res.status(401).send({message: 'unauthorized access'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
    if (err) {
      // console.log(err);
      return res.status(401).send({message: 'unauthorized access'})
    }
    // if token is valid then it would be decoded
    // console.log('value in the token', decoded)
    req.user = decoded;
    next();
  })
  
}

const cookeOption = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production'? true : false,
  sameSite:  process.env.NODE_ENV === 'production'? 'none' : 'strict'
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    const carCollection = client.db("carDoctorDB").collection('services');
    const checkOutCollection = client.db("carDoctorDB").collection('checkouts');

    // auth related api
    app.post('/jwt', logger, async(req, res) =>{
      const user =req.body;
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,{ expiresIn: '1h' });

      res.cookie('token', token, cookeOption)
      .send({success: true});
    })

    app.post('/logout', async(req, res) =>{
      const user = req.body;
      console.log('logging out', user);
      res.clearCookie('token', { ...cookeOption, maxAge: 0 }).send({ success: true })
    })

    // services related api
    app.get('/services', async(req, res) =>{
      const cursor = carCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/services/:id', async(req, res) =>{
      const id = req.params.id;
      const query = { _id: new ObjectId (id) }
      const options = {
      // Include only the `title` and `imdb` fields in each returned document
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const result = await carCollection.findOne(query, options);
      res.send(result);
    })

    // checkouts
    app.get('/checkouts', logger, verifyToken, async(req, res) =>{
      console.log(req.query.email);
      console.log('token owner info', req.user)
      if (req.user.email !== req.query.email) {
        return res.status(403).send({message: 'forbidden access'})
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await checkOutCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/checkouts', async(req, res) => {
      const order = req.body;
      // console.log(order);
      const result = await checkOutCollection.insertOne(order);
      res.send(result)
    })

    app.patch('/checkouts/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = { _id: new ObjectId (id) };
      const updatedCheckout = req.body;
      console.log(updatedCheckout);
      const updateDoc = {
        $set: {
          status: updatedCheckout.status
        },
      };
      const result = await checkOutCollection.updateOne(filter,updateDoc);
      res.send(result)
    })

    app.delete('/checkouts/:id', async(req, res) =>{
      const id = req.params.id;
      const query = { _id: new ObjectId (id) }
      const result = await checkOutCollection.deleteOne(query);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Car doctor is runing!')
})

app.listen(port, () => {
  console.log(`Car doctor is runing on port ${port}`)
})