const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const jwt = require('jsonwebtoken');

// middleware 
app.use(cors());
app.use(express.json());

const verifyJwt = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unAuthorized Access')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ messeage: 'forbidden Access' });
        }
        req.decoded = decoded;
        next();
    })
}


// mongodb database connection 

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.User_Name}:${process.env.User_Password}@cluster0.i9b8vs8.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        const appointmentOptionsCollection = client.db('doctorsPortal').collection('appointmentOptions');
        const bookingCollection = client.db('doctorsPortal').collection('bookings');
        const usersCollection = client.db('doctorsPortal').collection('users');


        app.get('/appointmentoptions', async (req, res) => {
            const date = req.query.date;
            const result = await appointmentOptionsCollection.find({}).toArray();

            // const bookingQuery = { selectedDate: date };
            // const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
            // result.forEach(option => {
            //     const optionBooked = alreadyBooked.filter(book => book.tretmentName === option.name);
            //     const bookedSloots = optionBooked.map(book => book.time);
            //     const remainningSlots = option.slots.filter(slot => !bookedSloots.includes(slot));
            //     option.slots = remainningSlots;
            // })
            
            const todaysBooked = await bookingCollection.find({selectedDate: date}).toArray();
            
            result.forEach(item => {
                const specificBooked = todaysBooked.filter(book => book.tretmentName === item.name);
                const bookedSlots = specificBooked.map(slot => slot.time);
                const remainningSlots = item.slots.filter(slot => !bookedSlots.includes(slot));
                item.slots = remainningSlots;
            })

            res.send(result);
        })

        app.get('/myappointments', verifyJwt, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ messeage: 'forbidden access' });
            }
            const query = { email: email };
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })


        // appointment booking
        app.post('/bookings', async (req, res) => {
            const bookigdata = req.body;
            // const bookingDateQuery = {
            //     selectedDate: bookigdata.selectedDate,
            //     tretmentName: bookigdata.tretmentName,
            //     email: bookigdata.email,

            // }
            // const alreadyBooked = await bookingCollection.find(bookingDateQuery).toArray();
            // if (alreadyBooked.length) {
            //     const messeage = `you already have booked ${bookigdata.selectedDate}`;
            //     return res.send({ acknowledged: false, messeage })
            // }
            
            const bookingQuery = {
                selectedDate: bookigdata.selectedDate,
                tretmentName: bookigdata.tretmentName,
                email: bookigdata.email,
            };
            const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();

            if(alreadyBooked.length){
                const message = `You have Already Booked ${bookigdata.selectedDate}`;
                return res.send({acknowledged: false, message});
            }

            const result = await bookingCollection.insertOne(bookigdata);
            res.send(result);
        })
        // JWT token 
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '2d' });
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' });

        })

        // get all users 
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find({}).toArray();
            res.send(result);
        })


        // user created 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })


        // get admin
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = {email: email};
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })


        // user make admin update 
        app.put('/users/admin/:id', verifyJwt, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ messeage: 'forbidden access' })
            }

            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

    }
    finally {

    }
}

run().catch(error => console.log(error));





app.get('/', (req, res) => {
    res.send('doctors portal is running...')
})

app.listen(port, (req, res) => {
    console.log('doctors portal server is running ');
})