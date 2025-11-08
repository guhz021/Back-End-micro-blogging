// Função para criar usuário
document.getElementById('formUsuario').addEventListener('submit', function(event) {
    event.preventDefault();
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
  
    fetch('http://localhost:3000/usuarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nome, email })
    })
    .then(response => response.json())
    .then(data => {
      alert('Usuário criado com sucesso!');
      console.log(data);
      listarUsuarios(); // Atualiza a lista de usuários
    })
    .catch(error => {
      alert('Erro ao criar usuário');
      console.error(error);
    });
  });
  
  // Função para criar postagem
  document.getElementById('formPostagem').addEventListener('submit', function(event) {
    event.preventDefault();
    const conteudo = document.getElementById('conteudoPostagem').value;
    const autorId = document.getElementById('autorId').value;
  
    fetch('http://localhost:3000/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ conteudo, autorId })
    })
    .then(response => response.json())
    .then(data => {
      alert('Postagem criada com sucesso!');
      console.log(data);
      listarTodosPosts(); // Atualiza a lista de posts
    })
    .catch(error => {
      alert('Erro ao criar postagem');
      console.error(error);
    });
  });
  
  // Função para listar postagens de um usuário
  function listarPostagensUsuario() {
    const usuarioId = document.getElementById('usuarioIdBusca').value;
  
    fetch(`http://localhost:3000/posts/usuario/${usuarioId}`)
    .then(response => response.json())
    .then(data => {
      const lista = document.getElementById('listaPostagensUsuario');
      lista.innerHTML = '';
  
      if (data.length === 0) {
        lista.innerHTML = '<li>Nenhuma postagem encontrada.</li>';
      } else {
        data.forEach(post => {
          const li = document.createElement('li');
          li.textContent = `Postagem: ${post.conteudo} | Data: ${new Date(post.data).toLocaleString()}`;
          lista.appendChild(li);
        });
      }
    })
    .catch(error => {
      alert('Erro ao buscar postagens do usuário');
      console.error(error);
    });
  }
  
  // Função para listar postagens por hashtag
  function listarPostagensHashtag() {
    let hashtag = document.getElementById('hashtagBusca').value.trim();
    if (hashtag.startsWith('#')) {
      hashtag = hashtag.substring(1);
    }
  
    if (!hashtag) {
      alert('Por favor, insira uma hashtag válida.');
      return;
    }
  
    const hashtagCodificada = encodeURIComponent(hashtag);
  
    fetch(`http://localhost:3000/posts/hashtag/${hashtagCodificada}`)
      .then(response => response.json())
      .then(data => {
        const lista = document.getElementById('listaPostagensHashtag');
        lista.innerHTML = '';
  
        if (data.length === 0) {
          lista.innerHTML = '<li>Nenhuma postagem encontrada com essa hashtag.</li>';
        } else {
          data.forEach(post => {
            const li = document.createElement('li');
            li.textContent = `Postagem: ${post.conteudo} | Data: ${new Date(post.data).toLocaleString()}`;
            lista.appendChild(li);
          });
        }
      })
      .catch(error => {
        alert('Erro ao buscar postagens por hashtag');
        console.error(error);
      });
  }
  
  // Função para listar usuários com botão de excluir
  function listarUsuarios() {
    fetch('http://localhost:3000/usuarios')
      .then(response => response.json())
      .then(usuarios => {
        const lista = document.getElementById('listaUsuarios');
        lista.innerHTML = '';
  
        usuarios.forEach(usuario => {
          const li = document.createElement('li');
          li.innerHTML = `${usuario.nome} (${usuario.email}) - ID: ${usuario._id}
            <button onclick="excluirUsuario('${usuario._id}')">Excluir</button>`;
          lista.appendChild(li);
        });
      })
      .catch(error => {
        alert('Erro ao listar usuários');
        console.error(error);
      });
  }
  
  // Função para listar todos os posts com botão de excluir
  function listarTodosPosts() {
    fetch('http://localhost:3000/posts')
      .then(response => response.json())
      .then(posts => {
        const lista = document.getElementById('listaTodosPosts');
        lista.innerHTML = '';
  
        posts.forEach(post => {
          const li = document.createElement('li');
          li.innerHTML = `${post.conteudo} - Autor: ${post.autorId} | ID: ${post._id}
            <button onclick="excluirPost('${post._id}')">Excluir</button>`;
          lista.appendChild(li);
        });
      })
      .catch(error => {
        alert('Erro ao listar posts');
        console.error(error);
      });
  }
  
  // Função para excluir um usuário
  function excluirUsuario(id) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
  
    fetch(`http://localhost:3000/usuarios/${id}`, {
      method: 'DELETE'
    })
    .then(response => response.text())
    .then(msg => {
      alert(msg);
      listarUsuarios();
    })
    .catch(error => {
      alert('Erro ao excluir usuário');
      console.error(error);
    });
  }
  
  // Função para excluir um post
  function excluirPost(id) {
    if (!confirm('Tem certeza que deseja excluir este post?')) return;
  
    fetch(`http://localhost:3000/posts/${id}`, {
      method: 'DELETE'
    })
    .then(response => response.text())
    .then(msg => {
      alert(msg);
      listarTodosPosts();
    })
    .catch(error => {
      alert('Erro ao excluir post');
      console.error(error);
    });
  }
  