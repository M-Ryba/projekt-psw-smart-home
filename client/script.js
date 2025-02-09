async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errorElement = document.getElementById("errorMessage");

  try {
    const response = await fetch("http://localhost:3333/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      window.location.href = "./dashboard/index.html";
    } else {
      errorElement.textContent = "Invalid username or password";
      errorElement.style.display = "block";
    }
  } catch (error) {
    errorElement.textContent = "Connection error. Please try again.";
    errorElement.style.display = "block";
  }
}

function showSection(sectionId) {
  document.querySelectorAll(".form-section").forEach((section) => {
    section.classList.remove("active");
  });
  document.getElementById(sectionId).classList.add("active");
}

async function handleRegister(event) {
  event.preventDefault();
  const username = document.getElementById("regUsername").value;
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const errorElement = document.getElementById("registerError");

  if (password !== confirmPassword) {
    errorElement.textContent = "Passwords do not match";
    errorElement.style.display = "block";
    return;
  }

  try {
    const response = await fetch("http://localhost:3333/accounts/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      showSection("loginForm");
      alert("Registration successful! Please login.");
    } else {
      const error = await response.text();
      errorElement.textContent = error || "Registration failed";
      errorElement.style.display = "block";
    }
  } catch (error) {
    errorElement.textContent = "Connection error. Please try again.";
    errorElement.style.display = "block";
  }
}

async function handlePasswordReset(event) {
  event.preventDefault();
  const username = document.getElementById("resetUsername").value;
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const errorElement = document.getElementById("resetError");

  try {
    const response = await fetch("http://localhost:3333/accounts/reset", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        oldPassword,
        newPassword,
      }),
    });

    const message = await response.text();

    if (response.ok) {
      showSection("loginForm");
      alert("Password reset successful! Please login with your new password.");
    } else {
      errorElement.textContent = message || "Password reset failed";
      errorElement.style.display = "block";
    }
  } catch (error) {
    errorElement.textContent = "Connection error. Please try again.";
    errorElement.style.display = "block";
  }
}
