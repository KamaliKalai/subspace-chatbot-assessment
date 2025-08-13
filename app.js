import { NHOST_BACKEND_URL } from "./config.js";
import { NhostClient } from 'https://cdn.jsdelivr.net/npm/@nhost/nhost-js/+esm';

const nhost = new NhostClient({ backendUrl: NHOST_BACKEND_URL });

const authDiv = document.getElementById("auth");
const chatDiv = document.getElementById("chat");

window.signupUser = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const { error } = await nhost.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert("Sign Up successful! Please Sign In.");
};

window.signinUser = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const { error } = await nhost.auth.signIn({ email, password });
    if (error) alert(error.message);
    else {
        authDiv.style.display = "none";
        chatDiv.style.display = "block";
    }
};

window.signoutUser = async () => {
    await nhost.auth.signOut();
    authDiv.style.display = "block";
    chatDiv.style.display = "none";
};

// Placeholder functions for chat
window.createChat = async () => alert("Create Chat function will be implemented");
window.sendMessage = async () => alert("Send Message function will be implemented");
