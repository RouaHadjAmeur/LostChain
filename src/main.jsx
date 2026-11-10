import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link,Navigate} from 'react-router-dom';
import {AppProvider} from './context/AppContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import {Explore,Report,Details,Auth,Dashboard,Claims,MyReports,Profile,Heading} from './pages/Pages';
import './styles.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><AppProvider><Routes><Route element={<Layout/>}><Route index element={<Home/>}/><Route path="explore" element={<Explore/>}/><Route path="report/:type" element={<Report/>}/><Route path="items/:id" element={<Details/>}/><Route path="auth" element={<Navigate to="/connect-wallet" replace/>}/><Route path="connect-wallet" element={<Navigate to="/login" replace/>}/><Route path="login" element={<Auth key="login"/>}/><Route path="register" element={<Auth key="register" register/>}/><Route path="my-reports" element={<MyReports/>}/><Route path="received-claims" element={<Claims key="received" received/>}/><Route path="profile" element={<Profile/>}/><Route path="dashboard" element={<Dashboard/>}/><Route path="claims" element={<Claims key="sent"/>}/><Route path="*" element={<Heading title="A little off the beaten path." description="This page doesn't exist."><Link to="/">Back to overview</Link></Heading>}/></Route></Routes></AppProvider></BrowserRouter></React.StrictMode>);
