// src/Pages/Profile.jsx

import './Profile.css';

const Profile = () => {
    return (
        <div className="profile-container">
            <div className="profile-header">
                <img
                    src="https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff&size=96"
                    alt="Profile Avatar"
                    className="profile-avatar"
                />
                <div>
                    <h1>Admin User</h1>
                    <p className="profile-email">admin@noveg.com</p>
                </div>
            </div>
            <div className="profile-section">
                <h2>Profile Settings</h2>
                <div className="profile-fields">
                    <div className="profile-field">
                        <label htmlFor="name">Name</label>
                        <input id="name" type="text" value="Admin User" readOnly />
                    </div>
                    <div className="profile-field">
                        <label htmlFor="email">Email</label>
                        <input id="email" type="email" value="admin@noveg.com" readOnly />
                    </div>
                </div>
            </div>
            <div className="profile-section">
                <h2>Notification Settings</h2>
                <div className="profile-toggle-row">
                    <span>Email Notifications</span>
                    <label className="switch">
                        <input type="checkbox" defaultChecked />
                        <span className="slider round"></span>
                    </label>
                </div>
                <p className="profile-desc">Receive notifications about new tickets</p>
            </div>
            <div className="profile-section">
                <h2>Security Settings</h2>
                <div className="profile-toggle-row">
                    <span>Two-Factor Authentication</span>
                    <label className="switch">
                        <input type="checkbox" />
                        <span className="slider round"></span>
                    </label>
                </div>
                <p className="profile-desc">Enable additional security for your account</p>
            </div>
        </div>
    );
};

export default Profile;
