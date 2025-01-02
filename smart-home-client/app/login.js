export default function Home() {
  return (
    <main>
      <h1 id="login-header">Login</h1>
      <form id="login-form">
        <input
          type="text"
          name="username"
          id="username-field"
          class="login-form-field"
          placeholder="Username"
        />
        <input
          type="password"
          name="password"
          id="password-field"
          class="login-form-field"
          placeholder="Password"
        />
        <input type="submit" value="Login" id="login-form-submit" />
      </form>
      <div id="login-error-box">
        <p class="login-error-msg">
          Invalid username
          <span class="login-error-msg">and/or password</span>
        </p>
      </div>
    </main>
  );
}
