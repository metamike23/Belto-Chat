"use client"; // Ensure this directive is at the top

import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import axios from 'axios'; // Import Axios
import './globals.css';
import './page.module.css'
import ToolDropdown from './components/ToolDropdown/ToolDropdown';
import Chatbox from './components/Chatbox/Chatbox';
import NavigationBar from './components/NavBar/NavBar';
import Sidebar from './components/SideBar/SideBar';
import ResponseSection from './components/ResponseSection/ResponseSection';
import ResponseLogo from './components/ResponseLogo/ResponseLogo'; // Ensure this path is correct

const Home: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Declare sidebarOpen state variable
  const [chatHistory, setChatHistory] = useState<{ text: string; sender: string; }[]>([]);
  const [messageSent, setMessageSent] = useState(false); // New state variable
  const [helloWorldMessage, setHelloWorldMessage] = useState(''); // State for the "Hello, World!" message

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
    setSidebarOpen(!sidebarOpen);
  };

  const handleChatHistoryChange = (newChatHistory: { text: string; sender: string; }[]) => {
    setChatHistory(newChatHistory);
    setMessageSent(true); // Update messageSent when a message is sent
  };

  useEffect(() => {
    axios.get('http://localhost:3001/api/hello')
      .then(response => {
        console.log(response.data.message);
        setHelloWorldMessage(response.data.message);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  }, []);

  return (
    <>
      <Head>
        <title>Home Page</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>

      <div className="ai-interface-first-look" style={{ height: '100vh', overflow: 'hidden' }}>
        <NavigationBar toggleSidebar={toggleSidebar} messageSent={messageSent} sidebarOpen={sidebarOpen}/>
        <Sidebar isOpen={isOpen} toggle={toggleSidebar} />
        <div className={isOpen ? 'contentOpen' : 'content'}>
          {messageSent && <ResponseLogo/>}
          {!messageSent && <ToolDropdown/>} {/* Conditionally render ToolDropdown */}
          <ResponseSection chatHistory={chatHistory}/>
          <Chatbox chatHistory={chatHistory} setChatHistory={setChatHistory} onMessageSend={() => setMessageSent(true)} messageSent = {messageSent}/>
          <div className="hello-world-message">
            <h1>{helloWorldMessage}</h1>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
