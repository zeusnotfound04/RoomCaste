package roomcaste

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/gorilla/websocket"
)
type Client struct {
	ID       string
	Conn     *websocket.Conn
	mu       sync.Mutex
	handlers []func([]byte)
}
func NewClient(id string, url string) (*Client, error) {
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return nil, err
	}

	client := &Client{
		ID:       id,
		Conn:     conn,
		handlers: make([]func([]byte), 0),
	}
	go client.listen()

	return client, nil
}

func (c *Client) Send(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	data, err := json.Marshal(v)
	if err != nil {
		return err
	}

	return c.Conn.WriteMessage(websocket.TextMessage, data)
}

func (c *Client) OnMessage(fn func([]byte)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers = append(c.handlers, fn)
}
func (c *Client) listen() {
	for {
		_, msg, err := c.Conn.ReadMessage()
		if err != nil {
			fmt.Println("read error:", err)
			return
		}

		c.mu.Lock()
		handlersCopy := append([]func([]byte){}, c.handlers...) 
		c.mu.Unlock()

		for _, handler := range handlersCopy {
			handler(msg)
		}
	}
}
func (c *Client) Close() error {
	return c.Conn.Close()
}
