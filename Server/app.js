// Import necessary libraries and modules
import express from 'express'; 
import bodyParser from 'body-parser'; 
import path from 'path'; 
import { fileURLToPath } from 'url'; 
import fetch from 'node-fetch';
import cors from 'cors'; // Middleware to enable Cross Resource Sharing
import { MongoClient } from 'mongodb'; // MongoDB client
import dotenv from 'dotenv'; // Load environment variables

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000; // Use the PORT from the .env file or default to 3000

// MongoDB connection details from .env
const url = process.env.MONGO_URI;
const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
const dbName = 'local_test';
let db;
let chatCollection;

// Connect to MongoDB
client.connect()
    .then(() => {
        console.log('Connected to MongoDB');
        db = client.db(dbName);
        chatCollection = db.collection('chats'); // Reference to the 'chats' collection
    })
    .catch(err => console.error('Failed to connect to MongoDB', err));

// Middleware to parse JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 

// Enable CORS for all routes (Important for frontend-backend communication across different origins)
app.use(cors());

// Determine the directory name 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));


let chatHistory = [
    {role: "system", content: "You are BeltoAI"}
]

// Function to fetch completion from the v1/chat/completions endpoint
async function fetchCompletion(history, n_predict, stream) {
    // Send a POST request to the external API with the chat history
    const response = await fetch("http://71.84.222.196:8080/v1/chat/completions", {
        method: 'POST',
        body: JSON.stringify({
            model: "gpt-3.5-turbo", // Model for generating the completion
            messages: history, // Use the full chat history
            n_predict, // tokens
            stream // Whether to stream 
        }),
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer no-key' } 
    });

    // Handle errors from the API
    if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    // Return the response object
    return response;
}

// POST endpoint to handle completion requests
// POST endpoint to handle completion requests
app.post('/completion', async (req, res) => {
    // Destructure request body and set default values if chatname or username are missing
    let { chatname = 'defaultChat', username = 'defaultUser', prompt, n_predict, stream } = req.body;

    try {
        // Update chat history with user's message, create new chat if it doesn't exist
        await updateChatHistory(chatname, username, 'user', prompt);

        // Retrieve the updated chat history
        const history = await getChatHistory(chatname, username);

        // Send the chat history to the AI completion API
        const response = await fetchCompletion(history, n_predict, stream);

        if (!stream) {
            const data = await response.json();
            const aiMessage = data.choices[0].message.content;

            // Update chat history with assistant's response
            await updateChatHistory(chatname, username, 'assistant', aiMessage);

            // Send the AI's response back to the client
            res.json({ content: aiMessage });
        } else {
            res.setHeader('Content-Type', 'text/plain');
            response.body.pipe(res); // Streaming the response
        }

    } catch (error) {
        console.error('Error in completion request:', error);
        res.status(500).send('Internal Server Error');
    }
});


// POST endpoint to create a new chat
app.post('/new-chat', async (req, res) => {
    const { chatname, username, initialMessage } = req.body;

    const chatDocument = {
        chatname: chatname || "Chat " + Date.now(), // Give a default name if not provided
        username: username || "default",
        history: [
            { role: "system", content: "You are BELTO, an AI assistant..." },
            { role: "user", content: initialMessage || "Hello, introduce yourself" }
        ]
    };

    try {
        const result = await chatCollection.insertOne(chatDocument);
        res.json({ success: true, chatId: result.insertedId });
    } catch (error) {
        console.error('Error creating new chat:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Function to get chat history from MongoDB
async function getChatHistory(chatname, username) {
    try {
        // Find the chat document by chatname and username
        const chat = await chatCollection.findOne({ chatname, username });
        if (!chat) {
            throw new Error('Chat not found');
        }
        return chat.history; // Return the chat history array
    } catch (error) {
        console.error('Error retrieving chat history:', error);
        throw error;
    }
}


// Function to update chat history from MongoDB
async function updateChatHistory(chatname, username, role, content) {
    try {
        // Check if the chat exists
        const chat = await chatCollection.findOne({ chatname, username });

        if (!chat) {
            // If chat is not found, create a new one with the initial message
            const newChatDocument = {
                chatname,
                username,
                history: [
                    { role, content } // Start the history with the new message
                ]
            };
            await chatCollection.insertOne(newChatDocument);
            console.log('Chat not found, new chat created.');
        } else {
            // If chat exists, update the existing chat history
            const result = await chatCollection.updateOne(
                { chatname, username }, // Find chat by chatname and username
                {
                    $push: {
                        history: { role, content } // Append the new message to the history array
                    }
                }
            );
            if (result.matchedCount === 0) {
                throw new Error('Chat not found or update failed');
            }
        }
    } catch (error) {
        console.error('Error updating chat history:', error);
        throw error;
    }
}

// POST endpoint to retrieve all chats for a given username
app.post('/getChat', async (req, res) => {
    const { username = 'defaultUser' } = req.body; // Default to 'defaultUser' if no username is provided

    try {
        // Find all chats with the specified username
        const chats = await chatCollection.find({ username }).toArray();

        if (chats.length === 0) {
            return res.status(404).json({ message: 'No chats found for this user' });
        }

        // Prepare the response data
        const numberOfChats = chats.length;
        const chatDetails = chats.map(chat => ({
            chatname: chat.chatname,
            history: chat.history
        }));

        // Send the response
        res.json({
            numberOfChats,
            chatDetails
        });

    } catch (error) {
        console.error('Error retrieving chats:', error);
        res.status(500).send('Internal Server Error');
    }
});


// POST endpoint to retrieve the history of a specific chat by username and chatname
app.post('/getChat', async (req, res) => {
    const { username = 'defaultUser', chatname = 'defaultChat' } = req.body;

    try {
        // Find the specific chat by username and chatname
        const chat = await chatCollection.findOne({ username, chatname });

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        // Return the history of the chat
        res.json({
            chatname: chat.chatname,
            history: chat.history
        });

    } catch (error) {
        console.error('Error retrieving chat history:', error);
        res.status(500).send('Internal Server Error');
    }
});



// Start the server and listen on the specified port
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`); // Log that the server is running
});
